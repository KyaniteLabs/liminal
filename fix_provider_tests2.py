import re

with open('test/unit/llm/provider-adapters.test.ts', 'r') as f:
    content = f.read()

# For API error cases - replace the pattern where we check result.success, result.error, result.content
# These are error cases (result.isErr())

# Pattern for API error tests
content = re.sub(
    r"it\('returns error response on API failure'.*?\n    mockFetchResponse\(\{ error:.*?\}, (\d+), false\);\n\n    const result = await provider\.generate\(makeRequest\(\)\);\n\n    expect\(result\.success\)\.toBe\(false\);\n    expect\(result\.error\)\.toContain\('(\d+)'\);",
    r"it('returns error response on API failure', async () => {\n    mockFetchResponse({ error: 'rate limited' }, \1, false);\n\n    const result = await provider.generate(makeRequest());\n\n    expect(result.isErr()).toBe(true);\n    expect(result.error.message).toContain('\2');",
    content,
    flags=re.DOTALL
)

# More specific replacements for error cases with status codes
for status in ['400', '401', '404', '429', '500', '503', '529']:
    # Replace error checking patterns
    content = re.sub(
        rf"expect\(result\.success\)\.toBe\(false\);\n    expect\(result\.error\)\.toContain\('{status}'\);",
        f"expect(result.isErr()).toBe(true);\n    expect(result.error.message).toContain('{status}');",
        content
    )

# For empty content success=false cases (need to check isOk + value.success)
# These are when API returns 200 but content is empty
content = re.sub(
    r"expect\(result\.success\)\.toBe\(false\);\n    expect\(result\.content\)\.toBe\(''\);",
    "expect(result.isOk()).toBe(true);\n    expect(result.value.success).toBe(false);\n    expect(result.value.content).toBe('');",
    content
)

with open('test/unit/llm/provider-adapters.test.ts', 'w') as f:
    f.write(content)

print("Fixed false cases")
