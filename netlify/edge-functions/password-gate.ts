const COOKIE_NAME = "site_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const LOGIN_PATH = "/_auth/login";

function getPassword(): string {
  return Netlify.env.get("SITE_PASSWORD") || "geheim";
}

async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode("nahost_gate_v1:" + value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loginPage(redirectTo: string, error = false): Response {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zugang – Nahost Faktencheck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --black: #0a0a0a;
    --white: #fafafa;
    --gray-200: #e8e8e8;
    --gray-400: #999;
    --gray-600: #555;
    --accent: #c0392b;
    --accent-light: #fdf0ef;
    --border: #e2e2e2;
    --radius: 12px;
  }
  body {
    font-family: 'Sora', sans-serif;
    background: var(--white);
    color: var(--black);
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 48px 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 2px 24px rgba(0,0,0,0.06);
  }
  .lock {
    width: 48px;
    height: 48px;
    background: var(--accent-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    font-size: 22px;
  }
  h1 {
    font-family: 'Fraunces', serif;
    font-size: 1.6rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 8px;
    color: var(--black);
  }
  p.sub {
    text-align: center;
    color: var(--gray-600);
    font-size: 0.88rem;
    margin-bottom: 32px;
  }
  label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--gray-600);
    margin-bottom: 8px;
  }
  input[type="password"] {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    font-family: 'Sora', sans-serif;
    font-size: 1rem;
    color: var(--black);
    background: var(--white);
    outline: none;
    transition: border-color 0.15s;
  }
  input[type="password"]:focus {
    border-color: var(--accent);
  }
  .error-msg {
    margin-top: 8px;
    font-size: 0.82rem;
    color: var(--accent);
    display: ${error ? "block" : "none"};
  }
  button {
    margin-top: 24px;
    width: 100%;
    padding: 13px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-family: 'Sora', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  button:hover { background: #a93226; }
  button:active { transform: scale(0.98); }
</style>
</head>
<body>
<div class="card">
  <div class="lock">🔒</div>
  <h1>Zugang geschützt</h1>
  <p class="sub">Bitte gib das Passwort ein, um fortzufahren.</p>
  <form method="POST" action="${LOGIN_PATH}">
    <input type="hidden" name="redirect" value="${redirectTo}">
    <label for="pw">Passwort</label>
    <input type="password" id="pw" name="password" autofocus autocomplete="current-password" placeholder="••••••••">
    <p class="error-msg">Falsches Passwort. Bitte erneut versuchen.</p>
    <button type="submit">Weiter</button>
  </form>
</div>
</body>
</html>`;

  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default async (req: Request, context: { cookies: { get: (n: string) => string | undefined; set: (opts: Record<string, unknown>) => void }; next: () => Promise<Response> }) => {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  // Handle login form submission
  if (method === "POST" && url.pathname === LOGIN_PATH) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return loginPage("/");
    }

    const submitted = formData.get("password") as string | null;
    const redirectTo = (formData.get("redirect") as string | null) || "/";

    if (submitted && submitted === getPassword()) {
      const token = await hashValue(submitted);
      const response = new Response(null, {
        status: 302,
        headers: { Location: redirectTo },
      });
      context.cookies.set({
        name: COOKIE_NAME,
        value: token,
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      });
      return response;
    }

    const redirectBack = (formData.get("redirect") as string | null) || "/";
    return loginPage(redirectBack, true);
  }

  // Check auth cookie
  const cookie = context.cookies.get(COOKIE_NAME);
  if (cookie) {
    const expected = await hashValue(getPassword());
    if (cookie === expected) {
      return; // authenticated — pass through
    }
  }

  // Not authenticated — show login page
  return loginPage(url.pathname + url.search);
};

export const config = {
  path: "/*",
};
