import re

with open('test/unit/llm/provider-adapters.test.ts', 'r') as f:
    content = f.read()

# Pattern 1: result.success in success checks (need isOk + value.success)
# Replace expect(result.success).toBe(true) for success cases
content = re.sub(
    r"expect\(result\.success\)\.toBe\(true\);",
    "expect(result.isOk()).toBe(true);\n    expect(result.value.success).toBe(true);",
    content
)

# Pattern 2: result.success in false checks for API failures (these should be isErr)
# We need context to know which ones are error cases vs empty content cases
# For now, let's handle the common patterns

with open('test/unit/llm/provider-adapters.test.ts', 'w') as f:
    f.write(content)

print("Fixed true cases")
