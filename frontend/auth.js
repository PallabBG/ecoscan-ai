const BACKEND_URL = window.BACKEND_URL;

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("msg").innerText = data.message;
      return;
    }

    // ✅ SAVE TOKEN
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // redirect
    window.location.href = "index.html";

  } catch (err) {
    document.getElementById("msg").innerText = "Login failed";
  }
}
