<?php
// Otomatis arahkan ke Node.js server di port 3000
header("Location: http://localhost:3000");
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0;url=http://localhost:3000">
    <title>Mengalihkan ke SkinCheck...</title>
    <style>
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            background: #f1f5f9;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
        }
        .card {
            background: #ffffff;
            border-radius: 1rem;
            padding: 2.5rem;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
            text-align: center;
        }
        .icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            color: #0f172a;
        }
        p {
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }
        .btn {
            display: inline-block;
            background: #0284c7;
            color: #ffffff;
            font-weight: 600;
            text-decoration: none;
            padding: 0.85rem 1.75rem;
            border-radius: 0.5rem;
            transition: background 0.2s ease;
        }
        .btn:hover {
            background: #0369a1;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✨</div>
        <h1>Menghubungkan ke SkinCheck</h1>
        <p>Aplikasi SkinCheck berjalan pada port 3000. Sedang mengalihkan Anda secara otomatis...</p>
        <a href="http://localhost:3000" class="btn">Buka Sekarang</a>
    </div>
    <script>
        window.location.href = "http://localhost:3000";
    </script>
</body>
</html>
