$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = 1

# 1. badge text
node fixmeta.js

# 2. real identity for all future commits
git config user.name 'Miftahul Islam Efaz'
git config user.email 'hello@miftahulislamefaz.xyz'

# 3. commit the badge fix with the correct identity
git add -A
git commit -m 'README: correct download size badge to ~1.3 MB' 2>&1 | Out-String

# 4. rewrite every existing commit to the real identity
$env:FILTER_BRANCH_SQUELCH_WARNING = 1
$envFilter = @'
export GIT_AUTHOR_NAME="Miftahul Islam Efaz"
export GIT_AUTHOR_EMAIL="hello@miftahulislamefaz.xyz"
export GIT_COMMITTER_NAME="Miftahul Islam Efaz"
export GIT_COMMITTER_EMAIL="hello@miftahulislamefaz.xyz"
'@
$envFilter = $envFilter -replace "`r`n", "`n"
Set-Content -Path envfilter.sh -Value $envFilter -NoNewline -Encoding ascii

Write-Output '--- rewriting history ---'
git filter-branch -f --env-filter '. ./envfilter.sh' -- --all 2>&1 | Out-String
Remove-Item -Force envfilter.sh -ErrorAction SilentlyContinue

Write-Output '--- authors now ---'
git log --pretty='%h  %an <%ae>  %s' | Out-String

Write-Output '--- force push ---'
git push --force origin main 2>&1 | Out-String
git ls-remote origin main
