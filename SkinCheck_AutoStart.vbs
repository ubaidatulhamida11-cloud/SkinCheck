Set WshShell = CreateObject("WScript.Shell")
strDir = "c:\xampp\htdocs\Project Skin Chek"
WshShell.CurrentDirectory = strDir

' Cek apakah port 3000 sudah aktif
Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :3000 | findstr LISTENING")
strOutput = oExec.StdOut.ReadAll()

If InStr(strOutput, "LISTENING") = 0 Then
    ' Jalankan node server.js diam-diam di background saat Windows menyala
    WshShell.Run "cmd /c node server.js", 0, False
End If
