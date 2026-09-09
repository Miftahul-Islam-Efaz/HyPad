; HyPad installer - Inno Setup 6
; Builds a standard Windows setup wizard (per-user, no admin prompt).

#define AppName    "HyPad"
#define AppVersion "1.0.1"
#define AppPublisher "Miftahul Islam Efaz"
#define AppURL     "https://github.com/Miftahul-Islam-Efaz/HyPad"
#define AppExe     "HyPad-win_x64.exe"

[Setup]
AppId={{8F3A9C21-4D7E-4B62-9E58-2B1C6A7F0D34}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/issues
AppUpdatesURL={#AppURL}/releases
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoProductName={#AppName}

; Per-user install: no UAC prompt, no admin rights required.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=no
AllowNoIcons=yes
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExe}
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

; Modern look
WizardStyle=modern
WizardSizePercent=110
SetupIconFile=..\resources\icons\appIcon.ico
ShowLanguageDialog=no
DisableWelcomePage=no

; Output
OutputDir=..\dist
OutputBaseFilename=HyPad-Setup
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
InternalCompressLevel=ultra64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "associate"; Description: "Open .txt and .md files with {#AppName}"; GroupDescription: "File associations:"; Flags: unchecked

[Files]
Source: "..\dist\HyPad\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\HyPad\resources.neu"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; AppUserModelID: "app.hybrid.scratchpad"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
; "Open with" support
Root: HKA; Subkey: "Software\Classes\Applications\{#AppExe}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Applications\{#AppExe}"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#AppName}"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\.txt\OpenWithList\{#AppExe}"; Flags: uninsdeletekey; Tasks: associate
Root: HKA; Subkey: "Software\Classes\.md\OpenWithList\{#AppExe}"; Flags: uninsdeletekey; Tasks: associate
Root: HKA; Subkey: "Software\Classes\.log\OpenWithList\{#AppExe}"; Flags: uninsdeletekey; Tasks: associate

[Run]
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
