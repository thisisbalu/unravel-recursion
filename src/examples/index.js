export const EXAMPLES = [
  {
    id: 'factorial',
    label: 'Factorial',
    code: `def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(result)`,
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    code: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

result = fib(5)
print(result)`,
  },
  {
    id: 'binary_search',
    label: 'Binary Search',
    code: `def binary_search(arr, target, low, high):
    if low > high:
        return -1
    mid = (low + high) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search(arr, target, mid + 1, high)
    else:
        return binary_search(arr, target, low, mid - 1)

nums = [1, 3, 5, 7, 9, 11, 13]
idx = binary_search(nums, 7, 0, len(nums) - 1)
print(idx)`,
  },
  {
    id: 'hanoi',
    label: 'Tower of Hanoi',
    code: `def hanoi(n, source, target, aux):
    if n == 1:
        print(f"Move disk 1 from {source} to {target}")
        return
    hanoi(n - 1, source, aux, target)
    print(f"Move disk {n} from {source} to {target}")
    hanoi(n - 1, aux, target, source)

hanoi(3, 'A', 'C', 'B')`,
  },
  {
    id: 'merge_sort',
    label: 'Merge Sort',
    code: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

arr = [38, 27, 43, 3, 9]
sorted_arr = merge_sort(arr)
print(sorted_arr)`,
  },
  {
    id: 'gcd',
    label: 'GCD (Euclid)',
    code: `# Why does swapping args and taking remainder converge?
# Watch the args shrink each call.
def gcd(a, b):
    if b == 0:
        return a
    return gcd(b, a % b)

result = gcd(48, 18)
print(result)`,
  },
  {
    id: 'fib_memo',
    label: 'Fibonacci + Memo',
    code: `# Compare with plain Fibonacci — memoization
# turns the exponential tree into a straight chain.
# Nodes with no children are cache hits.
memo = {}

def fib(n):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

result = fib(7)
print(result)`,
  },
  {
    id: 'permutations',
    label: 'Permutations',
    code: `# 3 characters → 6 results, but how many calls?
# Watch the tree fan out: each level removes one character
# and passes the rest down — the branching factor is n, n-1, n-2 ...
def permutations(s, prefix=""):
    if len(s) == 0:
        print(prefix)
        return
    for i in range(len(s)):
        permutations(s[:i] + s[i+1:], prefix + s[i])

permutations("ABC")`,
  },
  {
    id: 'mutual_recursion',
    label: 'Mutual Recursion',
    code: `# Two functions that call each other.
# The call tree alternates between is_even and is_odd —
# making the call stack mechanics impossible to miss.
def is_even(n):
    if n == 0:
        return True
    return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    return is_even(n - 1)

result = is_even(6)
print(result)`,
  },
  {
    id: 'fast_power',
    label: 'Fast Power',
    code: `# Computes 2^10 in ~5 calls instead of 10.
# When exp is even, it halves the problem each time — O(log n) depth.
# Compare mentally to a naive loop of 10 multiplications.
def power(base, exp):
    if exp == 0:
        return 1
    if exp % 2 == 0:
        half = power(base, exp // 2)
        return half * half
    return base * power(base, exp - 1)

result = power(2, 10)
print(result)`,
  },
]
