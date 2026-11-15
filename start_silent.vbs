Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Set direktori project
strDir = "c:\xampp\htdocs\Project Skin Chek"
WshShell.CurrentDirectory = strDir

' Cek apakah server sudah aktif di port 3000
Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :3000 | findstr LISTENING")
strOutput = oExec.StdOut.ReadAll()

If InStr(strOutput, "LISTENING") = 0 Then
    ' Jalankan node server.js di latar belakang (tanpa jendela hitam)
    WshShell.Run "cmd /c node server.js", 0, False
    WScript.Sleep 2000
End If

' Buka aplikasi di browser default
WshShell.Run "http://localhost:3000"
