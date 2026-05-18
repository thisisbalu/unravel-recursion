import sys
import json
import io

MAX_CALL_DEPTH = 50

def collect_frames(code):
    frames = []
    stdout_buf = io.StringIO()
    node_counter = [0]
    # call_id_stack tracks the unique id of the currently active call at each depth
    call_id_stack = []
    # call_tree is a list of root nodes; each node may have children
    call_tree_roots = []
    # flat map from id -> node for quick lookup
    node_map = {}
    overflow_triggered = [False]

    def new_node(func_name, args):
        node_counter[0] += 1
        nid = node_counter[0]
        node = {
            'id': nid,
            'funcName': func_name,
            'args': args,
            'returnValue': None,
            'status': 'active',
            'children': [],
            'depth': len(call_id_stack),
        }
        node_map[nid] = node
        if call_id_stack:
            parent = node_map[call_id_stack[-1]]
            parent['children'].append(nid)
        else:
            call_tree_roots.append(nid)
        return nid

    def serialize_tree(node_ids, _depth=0):
        # Cap at 60 levels so json.dumps never hits Python's recursion limit
        # even for pathological programs that trigger RecursionError.
        if _depth >= 60:
            return []
        result = []
        for nid in node_ids:
            n = node_map[nid]
            result.append({
                'id': n['id'],
                'funcName': n['funcName'],
                'args': n['args'],
                'returnValue': n['returnValue'],
                'status': n['status'],
                'children': serialize_tree(n['children'], _depth + 1),
                'depth': n['depth'],
            })
        return result

    def tracer(frame, event, arg):
        # Once overflow is handled, stop tracing entirely
        if overflow_triggered[0]:
            return None

        # Only trace user code — skip collect_frames internals and Pyodide runtime frames
        if frame.f_code.co_filename != '<user_code>':
            return tracer

        func_name = frame.f_code.co_name
        # skip anonymous frames like <lambda>, <listcomp>, etc.
        if func_name.startswith('<') and func_name != '<module>':
            return tracer

        # build call stack snapshot (user code frames only)
        stack = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == '<user_code>':
                name = f.f_code.co_name
                if not (name.startswith('<') and name != '<module>'):
                    locals_repr = {}
                    for k, v in f.f_locals.items():
                        if not k.startswith('__'):
                            try:
                                locals_repr[k] = repr(v)
                            except Exception:
                                locals_repr[k] = '?'
                    stack.insert(0, {
                        'funcName': name,
                        'lineNo': f.f_lineno,
                        'locals': locals_repr,
                    })
            f = f.f_back

        if event == 'call':
            # Detect deep recursion before Python's own RecursionError fires so
            # the overflow node lands within the visible tree range.
            if len(call_id_stack) >= MAX_CALL_DEPTH:
                overflow_triggered[0] = True
                nid = new_node(func_name, {})
                call_id_stack.append(nid)
                node_map[nid]['status'] = 'overflow'
                frames.append({
                    'event': 'overflow',
                    'lineNo': frame.f_lineno,
                    'callStack': stack,
                    'stdout': stdout_buf.getvalue(),
                    'callTree': serialize_tree(call_tree_roots),
                    'activeCallId': nid,
                })
                sys.settrace(None)
                return None

            args = {}
            for k, v in frame.f_locals.items():
                if not k.startswith('__'):
                    try:
                        args[k] = repr(v)
                    except Exception:
                        args[k] = '?'
            nid = new_node(func_name, args)
            call_id_stack.append(nid)

        elif event == 'return':
            if call_id_stack:
                nid = call_id_stack[-1]
                node = node_map[nid]
                node['status'] = 'completed'
                try:
                    node['returnValue'] = repr(arg)
                except Exception:
                    node['returnValue'] = '?'

        frames.append({
            'event': event,
            'lineNo': frame.f_lineno,
            'callStack': stack,
            'stdout': stdout_buf.getvalue(),
            'callTree': serialize_tree(call_tree_roots),
            'activeCallId': call_id_stack[-1] if call_id_stack else None,
        })

        if event == 'return' and call_id_stack:
            call_id_stack.pop()

        return tracer

    old_stdout = sys.stdout
    sys.stdout = stdout_buf
    sys.settrace(tracer)
    try:
        exec(compile(code, '<user_code>', 'exec'), {})
    except RecursionError:
        if frames:
            frames[-1]['event'] = 'overflow'
        if call_id_stack:
            node_map[call_id_stack[-1]]['status'] = 'overflow'
    except Exception as e:
        if frames:
            frames[-1]['event'] = 'exception'
            frames[-1]['error'] = str(e)
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout

    return json.dumps(frames)
