; Electron React App Installer Script
!include "MUI2.nsh"
!include "x64.nsh"

; Define the name, file, and default install folder
Name "Electron React App"
OutFile "dist\Electron-React-App-Setup.exe"
InstallDir "$PROGRAMFILES64\Electron React App"
InstallDirRegKey HKCU "Software\Electron React App" ""

; Request admin privileges
RequestExecutionLevel admin

; MUI Settings
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; Installer section
Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Copy files from the packaged app
  File /r "dist\Electron React App-win32-x64\*.*"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Electron React App"
  CreateShortcut "$SMPROGRAMS\Electron React App\Electron React App.lnk" "$INSTDIR\Electron React App.exe"
  CreateShortcut "$SMPROGRAMS\Electron React App\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\Electron React App.lnk" "$INSTDIR\Electron React App.exe"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Register in Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Electron React App" "DisplayName" "Electron React App"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Electron React App" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Electron React App" "" "$INSTDIR"
  
  MessageBox MB_OK "Electron React App has been installed successfully!"
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Remove shortcuts
  Delete "$SMPROGRAMS\Electron React App\Electron React App.lnk"
  Delete "$SMPROGRAMS\Electron React App\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Electron React App"
  Delete "$DESKTOP\Electron React App.lnk"
  
  ; Remove registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Electron React App"
  DeleteRegKey HKCU "Software\Electron React App"
  
  ; Remove installation directory
  RMDir /r "$INSTDIR"
SectionEnd
