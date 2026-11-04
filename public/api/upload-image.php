<?php
// UltraRide — réception des images (logos d'organisateurs, visuels d'ultras)
// sur l'hébergement OVH, à la place de Supabase Storage dont le quota de
// trafic gratuit (5 Go/mois) a été dépassé.
//
// POST multipart/form-data :
//   token  : jeton de session Supabase (access_token) de l'utilisateur connecté
//   file   : l'image
//   folder : organizers | races | uploads (nom de fichier aléatoire)
//   path   : (admin uniquement) chemin imposé, pour la copie des fichiers
//            de l'ancien bucket Supabase ; un fichier déjà présent est conservé
//
// Le jeton passe dans le formulaire et non dans un en-tête Authorization :
// le mutualisé OVH ne transmet pas toujours cet en-tête à PHP, et sans en-tête
// personnalisé la requête n'a pas besoin de pré-vérification CORS.
//
// Réponse JSON : { url, path, exists? } ou { error } avec un code HTTP.
// Compatible PHP 7.4+.

declare(strict_types=1);

// Un avertissement PHP affiché casserait la réponse JSON.
ini_set('display_errors', '0');

const PUBLIC_BASE = 'https://ultraride.eu/media/';
const MAX_BYTES = 8 * 1024 * 1024;
const FOLDERS = ['organizers', 'races', 'uploads'];
const UPLOAD_ROLES = ['admin', 'organizer'];
const ALLOWED_ORIGINS = [
    'https://ultraride.eu',
    'https://www.ultraride.eu',
    'https://ultraride.pages.dev',
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    'http://localhost:5173',
    'http://localhost:4173',
];
// Type réel (détecté sur le contenu) => extensions acceptées, la première
// sert aux noms générés.
const TYPES = [
    'image/png' => ['png'],
    'image/jpeg' => ['jpg', 'jpeg'],
    'image/webp' => ['webp'],
    'image/gif' => ['gif'],
    'image/svg+xml' => ['svg'],
];

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['error' => $message]);
}

// GET vers l'API Supabase avec le jeton de l'utilisateur : renvoie le JSON
// décodé, ou null si la requête échoue ou n'est pas un 200.
function supabase_get(array $config, string $path, string $token): ?array
{
    $url = rtrim((string) $config['supabase_url'], '/') . $path;
    $headers = [
        'apikey: ' . $config['anon_key'],
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    } else {
        // Sans ignore_errors, une réponse hors 2xx renvoie false.
        $context = stream_context_create(['http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $headers),
            'timeout' => 10,
        ]]);
        $body = @file_get_contents($url, false, $context);
        $status = is_string($body) ? 200 : 0;
    }
    if (!is_string($body) || $status !== 200) {
        return null;
    }
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

// Chemin relatif sûr : pas de segment vide, pas de segment commençant par un
// point (exclut « .. » et les fichiers cachés), pas de caractère de contrôle
// ni d'antislash.
function safe_path(string $path): ?string
{
    if ($path === '' || strlen($path) > 300 || preg_match('#[\x00-\x1f\x7f\\\\]#', $path)) {
        return null;
    }
    foreach (explode('/', $path) as $segment) {
        if ($segment === '' || $segment[0] === '.') {
            return null;
        }
    }
    return $path;
}

function detect_type(string $file): ?string
{
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file) ?: '';
    if (in_array($mime, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true)) {
        // Le contenu doit vraiment se décoder comme une image.
        return @getimagesize($file) !== false ? $mime : null;
    }
    // Selon la version de libmagic, un SVG sort en image/svg+xml, text/xml…
    if (in_array($mime, ['image/svg+xml', 'image/svg', 'text/xml', 'application/xml', 'text/plain', 'text/html'], true)) {
        $head = (string) file_get_contents($file, false, null, 0, 4096);
        return stripos($head, '<svg') !== false ? 'image/svg+xml' : null;
    }
    return null;
}

function public_url(string $path): string
{
    return PUBLIC_BASE . implode('/', array_map('rawurlencode', explode('/', $path)));
}

// --- CORS -------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}
if ($method !== 'POST') {
    fail(405, 'Méthode non autorisée.');
}

$config = @include __DIR__ . '/config.php';
if (!is_array($config) || empty($config['supabase_url']) || empty($config['anon_key'])) {
    fail(500, 'Serveur d\'images mal configuré (config.php manquant).');
}

// Requête plus grosse que post_max_size : PHP vide $_POST et $_FILES.
if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    fail(413, 'Fichier trop lourd (8 Mo maximum).');
}

// --- Qui envoie ? -------------------------------------------------------------

$token = isset($_POST['token']) && is_string($_POST['token']) ? $_POST['token'] : '';
if ($token === '' || strlen($token) > 8192) {
    fail(401, 'Connexion requise pour envoyer une image.');
}
$user = supabase_get($config, '/auth/v1/user', $token);
$uid = is_array($user) && isset($user['id']) ? (string) $user['id'] : '';
if (!preg_match('#^[0-9a-f-]{36}$#i', $uid)) {
    fail(401, 'Session expirée : reconnecte-toi puis réessaie.');
}
$rows = supabase_get($config, '/rest/v1/profiles?select=role&id=eq.' . rawurlencode($uid), $token);
$role = is_array($rows) && isset($rows[0]['role']) ? (string) $rows[0]['role'] : '';
if (!in_array($role, UPLOAD_ROLES, true)) {
    fail(403, 'Envoi d\'images réservé aux organisateurs et à l\'équipe UltraRide.');
}
$isAdmin = $role === 'admin';

// --- Le fichier ---------------------------------------------------------------

$file = isset($_FILES['file']) ? $_FILES['file'] : null;
if (!is_array($file) || !isset($file['error']) || is_array($file['error'])) {
    fail(400, 'Aucun fichier reçu.');
}
if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
    fail(413, 'Fichier trop lourd (8 Mo maximum).');
}
if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
    fail(400, 'Envoi interrompu, réessaie.');
}
if ($file['size'] > MAX_BYTES) {
    fail(413, 'Fichier trop lourd (8 Mo maximum).');
}

$type = detect_type($file['tmp_name']);
if ($type === null) {
    fail(415, 'Format non autorisé : PNG, JPEG, WebP ou GIF uniquement.');
}
// Un SVG peut embarquer du script : réservé à l'admin (et servi avec une CSP
// stricte, voir media/.htaccess).
if ($type === 'image/svg+xml' && !$isAdmin) {
    fail(415, 'Format non autorisé : PNG, JPEG, WebP ou GIF uniquement.');
}

// --- Où l'enregistrer ? -------------------------------------------------------

$forcedPath = isset($_POST['path']) && is_string($_POST['path']) ? $_POST['path'] : '';
if ($forcedPath !== '') {
    if (!$isAdmin) {
        fail(403, 'Chemin imposé réservé à l\'admin.');
    }
    $path = safe_path($forcedPath);
    if ($path === null) {
        fail(400, 'Chemin de fichier invalide.');
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!in_array($ext, TYPES[$type], true)) {
        fail(415, 'L\'extension ne correspond pas au contenu (' . $type . ').');
    }
} else {
    $folder = isset($_POST['folder']) && in_array($_POST['folder'], FOLDERS, true) ? $_POST['folder'] : 'uploads';
    $path = $folder . '/' . bin2hex(random_bytes(16)) . '.' . TYPES[$type][0];
}

$target = dirname(__DIR__) . '/media/' . $path;
if (file_exists($target)) {
    respond(200, ['url' => public_url($path), 'path' => $path, 'exists' => true]);
}
$dir = dirname($target);
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    fail(500, 'Impossible de créer le dossier de destination.');
}
if (!move_uploaded_file($file['tmp_name'], $target)) {
    fail(500, 'Enregistrement du fichier impossible.');
}
@chmod($target, 0644);

respond(201, ['url' => public_url($path), 'path' => $path]);
