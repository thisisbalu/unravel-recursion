"""
Pytest tests for src/engine/tracer.py

Run from the unravel/ directory:
    python -m pytest tests/test_tracer.py -v
"""
import sys
import json
import types
import os

# Make tracer importable without installing anything
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'engine'))

# tracer.py defines collect_frames() at module level — exec it into a fresh namespace
# so we can call the function without import side-effects.
_tracer_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'engine', 'tracer.py')
_tracer_ns = {}
with open(_tracer_path) as _f:
    exec(compile(_f.read(), _tracer_path, 'exec'), _tracer_ns)

collect_frames = _tracer_ns['collect_frames']


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(code: str):
    """Execute code through collect_frames and return the decoded frame list."""
    raw = collect_frames(code)
    return json.loads(raw)


def func_names_in_stack(frame):
    return [e['funcName'] for e in frame['callStack']]


def all_func_names(frames):
    """All funcNames that ever appear in any callStack entry across all frames."""
    names = set()
    for f in frames:
        for entry in f['callStack']:
            names.add(entry['funcName'])
    return names


def find_nodes(call_tree, predicate, _out=None):
    """Recursively collect call-tree nodes matching predicate (from last frame)."""
    if _out is None:
        _out = []
    for node in call_tree:
        if predicate(node):
            _out.append(node)
        find_nodes(node['children'], predicate, _out)
    return _out


# ---------------------------------------------------------------------------
# 1. Basic execution
# ---------------------------------------------------------------------------

class TestBasicExecution:
    def test_simple_program_produces_frames(self):
        frames = run("x = 1 + 1")
        assert len(frames) > 0

    def test_first_frame_is_module_call(self):
        frames = run("x = 1")
        first = frames[0]
        assert first['event'] == 'call'
        assert '<module>' in func_names_in_stack(first)

    def test_frame_has_required_keys(self):
        frames = run("x = 1")
        required = {'event', 'lineNo', 'callStack', 'stdout', 'callTree', 'activeCallId'}
        for frame in frames:
            assert required <= frame.keys(), f"Frame missing keys: {required - frame.keys()}"

    def test_callstack_entry_has_required_keys(self):
        frames = run("x = 1")
        for frame in frames:
            for entry in frame['callStack']:
                assert 'funcName' in entry
                assert 'lineNo' in entry
                assert 'locals' in entry

    def test_no_collect_frames_in_any_frame(self):
        """Regression: collect_frames' own frames must never leak into output."""
        frames = run("result = 1 + 2")
        for frame in frames:
            for entry in frame['callStack']:
                assert entry['funcName'] != 'collect_frames', (
                    "collect_frames internal frame leaked into output"
                )

    def test_no_tracer_internals_in_any_frame(self):
        """No internal helper names from tracer.py should appear."""
        internal = {'new_node', 'serialize_tree', 'tracer'}
        frames = run("x = 42")
        names = all_func_names(frames)
        assert not (names & internal), f"Internal names leaked: {names & internal}"

    def test_lineNo_is_integer(self):
        frames = run("x = 1\ny = 2")
        for frame in frames:
            assert isinstance(frame['lineNo'], int)

    def test_activeCallId_is_int_or_none(self):
        frames = run("x = 1")
        for frame in frames:
            assert frame['activeCallId'] is None or isinstance(frame['activeCallId'], int)


# ---------------------------------------------------------------------------
# 2. Call / return symmetry
# ---------------------------------------------------------------------------

class TestCallReturnSymmetry:
    def test_call_return_counts_match_for_simple_recursion(self):
        code = """
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

factorial(3)
"""
        frames = run(code)
        calls = [f for f in frames if f['event'] == 'call']
        returns = [f for f in frames if f['event'] == 'return']
        assert len(calls) == len(returns), (
            f"call count ({len(calls)}) != return count ({len(returns)})"
        )

    def test_no_orphan_return_without_call(self):
        """Every function that returns must have been called first."""
        code = """
def add(a, b):
    return a + b

add(2, 3)
"""
        frames = run(code)
        called = set()
        for f in frames:
            names = func_names_in_stack(f)
            if f['event'] == 'call' and names:
                called.add(names[-1])  # innermost frame
            if f['event'] == 'return':
                # innermost frame on a return should be something we called
                if names:
                    assert names[-1] in called, f"{names[-1]} returned but was never called"

    def test_events_sequence_starts_and_ends_with_module(self):
        frames = run("x = 1")
        assert frames[0]['event'] == 'call'
        assert frames[-1]['event'] == 'return'


# ---------------------------------------------------------------------------
# 3. Call stack correctness at depth
# ---------------------------------------------------------------------------

class TestCallStackCorrectness:
    def test_deepest_stack_contains_all_names_in_order(self):
        code = """
def a():
    return b()

def b():
    return c()

def c():
    return 99

a()
"""
        frames = run(code)
        # Find the frame where c is at the top of the stack
        deepest = None
        for f in frames:
            names = func_names_in_stack(f)
            if 'c' in names and 'b' in names and 'a' in names:
                deepest = f
                break
        assert deepest is not None, "Expected a frame with a→b→c on stack"
        names = func_names_in_stack(deepest)
        # Stack is ordered outermost-first: <module>, a, b, c
        assert names.index('<module>') < names.index('a'), "module should be before a"
        assert names.index('a') < names.index('b'), "a should be before b"
        assert names.index('b') < names.index('c'), "b should be before c"

    def test_stack_shrinks_after_return(self):
        code = """
def inner():
    return 1

def outer():
    return inner()

outer()
"""
        frames = run(code)
        # Find deepest stack size
        max_depth = max(len(f['callStack']) for f in frames)
        # Find stack size in a return frame for outer (after inner has returned)
        outer_return = None
        for f in frames:
            if f['event'] == 'return' and 'outer' in func_names_in_stack(f):
                # At this point inner should not be on the stack
                names = func_names_in_stack(f)
                if 'inner' not in names:
                    outer_return = f
                    break
        assert outer_return is not None, "Expected a frame where outer returns without inner on stack"
        assert len(outer_return['callStack']) < max_depth

    def test_locals_captured_in_stack_frame(self):
        code = """
def greet(name):
    msg = "hello"
    return msg

greet("world")
"""
        frames = run(code)
        # After the assignment `msg = "hello"` executes, greet's locals should include name
        greet_frames = [f for f in frames if 'greet' in func_names_in_stack(f)]
        assert greet_frames, "No frames found with greet on stack"
        # Find a frame where greet's locals include 'name'
        found_name = False
        for f in greet_frames:
            for entry in f['callStack']:
                if entry['funcName'] == 'greet' and 'name' in entry['locals']:
                    found_name = True
        assert found_name, "Expected 'name' in greet's locals at some point"

    def test_dunder_locals_excluded(self):
        """__dunder__ variables must not appear in locals."""
        code = """
def foo():
    x = 1
    return x

foo()
"""
        frames = run(code)
        for frame in frames:
            for entry in frame['callStack']:
                for key in entry['locals']:
                    assert not key.startswith('__'), f"Dunder key leaked: {key}"


# ---------------------------------------------------------------------------
# 4. Call tree structure
# ---------------------------------------------------------------------------

class TestCallTree:
    def test_factorial_3_has_four_factorial_nodes(self):
        """factorial(3) calls factorial(3), factorial(2), factorial(1), factorial(0) = 4 nodes."""
        code = """
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

factorial(3)
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        factorial_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'factorial')
        assert len(factorial_nodes) == 4, (
            f"Expected 4 factorial nodes, got {len(factorial_nodes)}"
        )

    def test_call_tree_root_is_module(self):
        code = """
def f():
    return 1

f()
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        assert len(last_tree) >= 1
        assert last_tree[0]['funcName'] == '<module>'

    def test_call_tree_parent_child_relationship(self):
        """The module node should have the user function as a child."""
        code = """
def foo():
    return 42

foo()
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        module_node = last_tree[0]
        child_names = [c['funcName'] for c in module_node['children']]
        assert 'foo' in child_names, f"Expected 'foo' as child of module, got {child_names}"

    def test_call_tree_depth_field(self):
        code = """
def outer():
    return inner()

def inner():
    return 1

outer()
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        inner_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'inner')
        outer_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'outer')
        assert inner_nodes and outer_nodes
        assert inner_nodes[0]['depth'] > outer_nodes[0]['depth']

    def test_active_node_status_is_active_mid_execution(self):
        """During a call, the active node should have status 'active'."""
        code = """
def slow():
    return 1

slow()
"""
        frames = run(code)
        # Find a call frame for slow
        slow_call_frames = [f for f in frames if f['event'] == 'call' and
                            any(e['funcName'] == 'slow' for e in f['callStack'])]
        assert slow_call_frames
        f = slow_call_frames[0]
        active_id = f['activeCallId']
        tree = f['callTree']
        active_nodes = find_nodes(tree, lambda n: n['id'] == active_id)
        assert active_nodes
        assert active_nodes[0]['status'] == 'active'


# ---------------------------------------------------------------------------
# 5. Return values in call tree
# ---------------------------------------------------------------------------

class TestReturnValues:
    def test_completed_factorial_nodes_have_correct_return_values(self):
        code = """
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

factorial(3)
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        factorial_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'factorial')
        completed = [n for n in factorial_nodes if n['status'] == 'completed']
        return_values = {n['returnValue'] for n in completed}
        # factorial(0)=1, factorial(1)=1, factorial(2)=2, factorial(3)=6
        assert '1' in return_values
        assert '2' in return_values
        assert '6' in return_values

    def test_completed_node_has_non_none_return_value(self):
        code = """
def add(a, b):
    return a + b

add(3, 4)
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        add_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'add')
        assert add_nodes
        completed = [n for n in add_nodes if n['status'] == 'completed']
        assert completed
        assert completed[0]['returnValue'] == '7'

    def test_active_node_return_value_is_none(self):
        """A node that hasn't returned yet should have returnValue == None."""
        code = """
def f():
    return 1

f()
"""
        frames = run(code)
        # In the first call frame for f, the node should still be active with no returnValue
        for frame in frames:
            if frame['event'] == 'call':
                active_id = frame['activeCallId']
                if active_id is not None:
                    tree = frame['callTree']
                    active_nodes = find_nodes(tree, lambda n: n['id'] == active_id)
                    if active_nodes and active_nodes[0]['funcName'] == 'f':
                        assert active_nodes[0]['returnValue'] is None
                        break


# ---------------------------------------------------------------------------
# 6. Stack overflow detection
# ---------------------------------------------------------------------------

class TestStackOverflow:
    def test_recursion_error_produces_overflow_event(self):
        code = """
def inf():
    return inf()

inf()
"""
        frames = run(code)
        overflow_frames = [f for f in frames if f['event'] == 'overflow']
        assert len(overflow_frames) >= 1, "Expected at least one overflow frame"

    def test_overflow_node_has_overflow_status(self):
        code = """
def inf():
    return inf()

inf()
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        overflow_nodes = find_nodes(last_tree, lambda n: n['status'] == 'overflow')
        assert len(overflow_nodes) >= 1, "Expected at least one overflow node in call tree"

    def test_overflow_last_frame_is_overflow_event(self):
        code = """
def inf():
    return inf()

inf()
"""
        frames = run(code)
        assert frames[-1]['event'] == 'overflow'

    def test_normal_recursion_does_not_overflow(self):
        code = """
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

factorial(5)
"""
        frames = run(code)
        overflow_frames = [f for f in frames if f['event'] == 'overflow']
        assert len(overflow_frames) == 0


# ---------------------------------------------------------------------------
# 7. Exception handling
# ---------------------------------------------------------------------------

class TestExceptionHandling:
    def test_value_error_produces_exception_event(self):
        code = """
def boom():
    raise ValueError("oops")

boom()
"""
        frames = run(code)
        exception_frames = [f for f in frames if f['event'] == 'exception']
        assert len(exception_frames) >= 1

    def test_exception_frame_has_error_field(self):
        code = """
raise ValueError("test error")
"""
        frames = run(code)
        exception_frames = [f for f in frames if f['event'] == 'exception']
        assert exception_frames
        assert 'error' in exception_frames[-1]
        assert 'test error' in exception_frames[-1]['error']

    def test_zero_division_produces_exception(self):
        code = """
x = 1 / 0
"""
        frames = run(code)
        exception_frames = [f for f in frames if f['event'] == 'exception']
        assert len(exception_frames) >= 1

    def test_type_error_produces_exception(self):
        code = """
def f(x):
    return x + "string"

f(1)
"""
        frames = run(code)
        exception_frames = [f for f in frames if f['event'] == 'exception']
        assert len(exception_frames) >= 1

    def test_frames_produced_before_exception(self):
        """Even when an exception is raised, earlier frames should still be there."""
        code = """
def f():
    x = 1
    raise RuntimeError("fail")

f()
"""
        frames = run(code)
        assert len(frames) > 1
        events = [f['event'] for f in frames]
        assert 'call' in events
        assert 'exception' in events


# ---------------------------------------------------------------------------
# 8. Stdout capture
# ---------------------------------------------------------------------------

class TestStdoutCapture:
    def test_print_accumulates_in_stdout_field(self):
        code = """
print("hello")
print("world")
"""
        frames = run(code)
        # The last frame should have both lines of stdout
        last = frames[-1]
        assert 'hello' in last['stdout']
        assert 'world' in last['stdout']

    def test_stdout_is_empty_before_any_print(self):
        code = """
x = 1
print("now")
"""
        frames = run(code)
        # First frame (call event for module) should have empty stdout
        assert frames[0]['stdout'] == ''

    def test_stdout_accumulates_across_frames(self):
        """stdout should grow monotonically — each frame has at least as much as the last."""
        code = """
print("a")
print("b")
print("c")
"""
        frames = run(code)
        for i in range(1, len(frames)):
            prev_len = len(frames[i - 1]['stdout'])
            curr_len = len(frames[i]['stdout'])
            assert curr_len >= prev_len, (
                f"stdout shrank between frame {i-1} and {i}: "
                f"{prev_len!r} -> {curr_len!r}"
            )

    def test_print_in_recursive_function_captured(self):
        code = """
def countdown(n):
    if n == 0:
        return
    print(n)
    countdown(n - 1)

countdown(3)
"""
        frames = run(code)
        last = frames[-1]
        assert '3' in last['stdout']
        assert '2' in last['stdout']
        assert '1' in last['stdout']

    def test_no_stdout_leak_to_real_stdout(self, capsys):
        """collect_frames must restore sys.stdout — captured output must not appear on real stdout."""
        code = 'print("secret")'
        run(code)
        captured = capsys.readouterr()
        assert 'secret' not in captured.out


# ---------------------------------------------------------------------------
# 9. No internal frames (co_filename filter regression)
# ---------------------------------------------------------------------------

class TestNoInternalFrames:
    def test_all_callstack_funcnames_exist_in_user_code(self):
        """No funcName in any callStack entry should be from tracer internals."""
        code = """
def outer(x):
    return inner(x + 1)

def inner(y):
    return y * 2

outer(5)
"""
        user_defined = {'outer', 'inner', '<module>'}
        frames = run(code)
        for frame in frames:
            for entry in frame['callStack']:
                assert entry['funcName'] in user_defined, (
                    f"Unexpected funcName in callStack: {entry['funcName']!r}"
                )

    def test_collect_frames_locals_not_in_any_frame(self):
        """Variables local to collect_frames (frames, node_map, etc.) must not appear."""
        collect_frames_locals = {
            'frames', 'stdout_buf', 'node_counter', 'call_id_stack',
            'call_tree_roots', 'node_map', 'old_stdout', 'code',
        }
        user_code = "x = 42"
        result = run(user_code)
        for frame in result:
            for entry in frame['callStack']:
                overlap = set(entry['locals'].keys()) & collect_frames_locals
                assert not overlap, (
                    f"Tracer-internal locals leaked into frame for {entry['funcName']}: {overlap}"
                )

    def test_tracer_file_not_in_any_stack_lineno(self):
        """All lineNo values should be user-code line numbers (small positive ints)."""
        code = """
def f(n):
    return n + 1

f(10)
"""
        frames = run(code)
        # Line numbers should all be <= the number of lines in user_code
        max_line = len(code.splitlines())
        for frame in frames:
            # frame.lineNo should be within user code range
            assert 1 <= frame['lineNo'] <= max_line, (
                f"lineNo {frame['lineNo']} out of range for user code"
            )
            for entry in frame['callStack']:
                assert 1 <= entry['lineNo'] <= max_line, (
                    f"callStack entry lineNo {entry['lineNo']} out of range"
                )


# ---------------------------------------------------------------------------
# 10. Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_code_returns_json_array(self):
        raw = collect_frames("")
        result = json.loads(raw)
        assert isinstance(result, list)

    def test_syntax_error_returns_empty_frames_or_list(self):
        """Syntax errors happen at compile time (before settrace), so frames is empty."""
        raw = collect_frames("def (broken:")
        result = json.loads(raw)
        assert isinstance(result, list)
        # Syntax errors raise SyntaxError before exec starts, so no frames are collected
        assert len(result) == 0

    def test_multiline_program(self):
        code = """
x = 1
y = 2
z = x + y
"""
        frames = run(code)
        assert len(frames) > 0

    def test_nested_function_definition(self):
        code = """
def outer():
    def inner():
        return 42
    return inner()

outer()
"""
        frames = run(code)
        # Should complete without error
        assert frames[-1]['event'] in ('return', 'line')
        names = all_func_names(frames)
        assert 'outer' in names

    def test_mutual_recursion(self):
        code = """
def is_even(n):
    if n == 0:
        return True
    return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    return is_even(n - 1)

is_even(4)
"""
        frames = run(code)
        names = all_func_names(frames)
        assert 'is_even' in names
        assert 'is_odd' in names
        # Should not overflow for small input
        overflow_frames = [f for f in frames if f['event'] == 'overflow']
        assert len(overflow_frames) == 0

    def test_function_with_args_and_kwargs(self):
        code = """
def func(a, b=10, *args, **kwargs):
    return a + b

func(1, 2)
"""
        frames = run(code)
        assert len(frames) > 0
        func_frames = [f for f in frames if 'func' in func_names_in_stack(f)]
        assert func_frames

    def test_return_value_preserved_as_repr(self):
        """Return values are stored as repr() strings."""
        code = """
def get_list():
    return [1, 2, 3]

get_list()
"""
        frames = run(code)
        last_tree = frames[-1]['callTree']
        list_nodes = find_nodes(last_tree, lambda n: n['funcName'] == 'get_list')
        completed = [n for n in list_nodes if n['status'] == 'completed']
        assert completed
        assert completed[0]['returnValue'] == '[1, 2, 3]'

    def test_lambda_not_captured_as_named_frame(self):
        """Lambdas should be skipped by the tracer (funcName starts with '<')."""
        code = """
square = lambda x: x * x
result = square(5)
"""
        frames = run(code)
        # No frame should have funcName == '<lambda>'
        for frame in frames:
            for entry in frame['callStack']:
                assert entry['funcName'] != '<lambda>', "Lambda frame should be filtered"

    def test_result_is_valid_json(self):
        """collect_frames must always return valid JSON, even on error."""
        for code in ["x = 1", "raise ValueError('x')", "def inf():\n    inf()\ninf()", ""]:
            raw = collect_frames(code)
            try:
                parsed = json.loads(raw)
                assert isinstance(parsed, list)
            except json.JSONDecodeError as e:
                assert False, f"collect_frames returned invalid JSON for {code!r}: {e}"

    def test_large_locals_dont_crash(self):
        """Large data structures in locals should not crash the tracer."""
        code = """
def process(data):
    result = sorted(data)
    return result

process(list(range(100)))
"""
        frames = run(code)
        assert len(frames) > 0

    def test_frames_returned_as_json_string(self):
        """collect_frames return type must be a str (JSON-encoded)."""
        raw = collect_frames("x = 1")
        assert isinstance(raw, str)
