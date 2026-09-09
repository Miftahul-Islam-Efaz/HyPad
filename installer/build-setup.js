/*
  Builds dist/HyPad-Setup.exe - a single double-clickable installer.

  Windows will not run a .ps1 on double-click (it offers "open with" instead),
  so the script is wrapped in a self-extracting package built with IExpress,
  which ships with every copy of Windows. Double-clicking the result behaves
  like any other Windows installer: it asks to install, extracts to a temp
  folder, registers HyPad, then launches it.

  IExpress cannot handle paths containing spaces, so the whole package is
  assembled in a short temp working directory and copied back afterwards.
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const app = path.join(dist, 'HyPad');
const finalExe = path.join(dist, 'HyPad-Setup.exe');

if (!fs.existsSync(path.join(app, 'HyPad-win_x64.exe')))
  throw new Error('Build the app first: neu build --release');

// a space-free working directory on the same drive
const work = path.join(path.parse(os.tmpdir()).root, 'hypad_setup_build');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const appFiles = ['HyPad-win_x64.exe', 'resources.neu'];
for (const f of appFiles) fs.copyFileSync(path.join(app, f), path.join(work, f));
for (const f of ['Install-HyPad.ps1', 'Uninstall-HyPad.ps1', 'setup.cmd'])
  fs.copyFileSync(path.join(root, 'installer', f), path.join(work, f));

const packaged = [...appFiles, 'Install-HyPad.ps1', 'Uninstall-HyPad.ps1', 'setup.cmd'];
const sedPath = path.join(work, 'hypad.sed');
const builtExe = path.join(work, 'HyPad-Setup.exe');

const fileKeys = packaged.map((f, i) => `FILE${i}="${f}"`).join('\r\n');
const fileList = packaged.map((_, i) => `%FILE${i}%=`).join('\r\n');

const sed = `[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[Strings]
InstallPrompt=Install HyPad on this PC?
DisplayLicense=
FinishMessage=HyPad has been installed. You will find it in the Start menu and in Settings > Apps > Installed apps.
TargetName=${builtExe}
FriendlyName=HyPad Setup
AppLaunched=cmd /c setup.cmd
PostInstallCmd=<None>
${fileKeys}
[SourceFiles]
SourceFiles0=${work}
[SourceFiles0]
${fileList}
`;

fs.writeFileSync(sedPath, sed, 'latin1');

execFileSync(path.join(process.env.WINDIR, 'System32', 'iexpress.exe'),
  ['/N', '/Q', sedPath], { stdio: 'inherit', cwd: work });

if (!fs.existsSync(builtExe)) throw new Error('IExpress did not produce HyPad-Setup.exe');
fs.rmSync(finalExe, { force: true });
fs.copyFileSync(builtExe, finalExe);
fs.rmSync(work, { recursive: true, force: true });
console.log('HyPad-Setup.exe  ' + fs.statSync(finalExe).size + ' bytes');
