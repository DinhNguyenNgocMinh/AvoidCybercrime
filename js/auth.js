import { supabaseConfig } from "./supabase-config.js";

const dialog = document.querySelector("#auth-dialog");
const form = document.querySelector("#auth-form");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#submit-auth");
const message = document.querySelector("#auth-message");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const accountName = document.querySelector("#account-name");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");
let mode = "login";
let supabase;

const configured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);

if (configured) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey);
  const { data: { session } } = await supabase.auth.getSession();
  updateAccount(session?.user ?? null);
  await loadProgress(session?.user ?? null);
}

function updateAccount(user) {
  const name = user?.user_metadata?.username;
  accountName.hidden = !name;
  accountName.textContent = name || "";
  loginButton.hidden = Boolean(user);
  signupButton.hidden = Boolean(user);
  logoutButton.hidden = !user;
}

async function loadProgress(user) {
  if (!user || !supabase) {
    updateLevelButtons(1);
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("max_level")
    .eq("id", user.id)
    .single();

  updateLevelButtons(error ? 1 : data.max_level);
}

function updateLevelButtons(maxLevel) {
  document.querySelectorAll("[data-level]").forEach((levelButton) => {
    const level = Number(levelButton.dataset.level);
    const unlocked = level <= maxLevel;
    levelButton.classList.toggle("locked", !unlocked);
    levelButton.setAttribute("aria-disabled", String(!unlocked));
    levelButton.tabIndex = unlocked ? 0 : -1;
    const lock = levelButton.querySelector(".lock");
    if (lock) lock.hidden = unlocked;
  });
}

async function usernameEmail(value) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const id = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${id}@users.avoidcybercrime.invalid`;
}

function openAuth(nextMode) {
  mode = nextMode;
  title.textContent = mode === "login" ? "LOGIN" : "SIGN UP";
  submit.textContent = mode === "login" ? "LOGIN" : "CREATE ACCOUNT";
  password.autocomplete = mode === "login" ? "current-password" : "new-password";
  message.textContent = "";
  form.reset();
  dialog.showModal();
  username.focus();
}

loginButton.addEventListener("click", () => openAuth("login"));
signupButton.addEventListener("click", () => openAuth("signup"));
document.querySelector("#cancel-auth").addEventListener("click", () => dialog.close());

logoutButton.addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
  updateAccount(null);
  updateLevelButtons(1);
});

document.querySelectorAll("[data-level]").forEach((levelButton) => {
  levelButton.addEventListener("click", (event) => {
    if (levelButton.classList.contains("locked")) event.preventDefault();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = username.value.trim();
  const secret = password.value;
  if (name.length < 4 || secret.length < 4) {
    message.textContent = "Username và password cần tối thiểu 4 ký tự.";
    return;
  }
  if (!supabase) {
    message.textContent = "Chưa kết nối Supabase. Hãy điền Project URL và publishable key vào assets/supabase-config.js.";
    return;
  }
  submit.disabled = true;
  message.textContent = "Đang xử lý...";
  const email = await usernameEmail(name);
  const result = mode === "signup"
    ? await supabase.auth.signUp({ email, password: secret, options: { data: { username: name } } })
    : await supabase.auth.signInWithPassword({ email, password: secret });
  submit.disabled = false;
  if (result.error) {
    message.textContent = result.error.message;
    return;
  }
  if (mode === "signup" && !result.data.session) {
    message.textContent = "Tài khoản đã tạo. Hãy tắt Confirm email trong Supabase Auth để đăng nhập ngay mà không cần email.";
    return;
  }
  const user = result.data.user ?? result.data.session?.user;
  updateAccount(user);
  await loadProgress(user);
  dialog.close();
});
