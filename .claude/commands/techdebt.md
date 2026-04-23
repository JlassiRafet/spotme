Scan the entire SpotMe codebase for technical debt. Report only real issues.

Check for:
1. Duplicate code across files
2. Dead/unused code (functions, imports, variables)
3. Inconsistencies (mixed patterns doing same thing)
4. Security issues (exposed keys, missing validation)
5. TODO/FIXME comments

Output format per issue:
- File:line — problem — fix in 5 words

Sort by severity: critical → medium → low.
After listing, ask: "Fix all? Or pick specific ones?"
