import { auth, onAuthStateChanged } from "./firebase.js";

export const categories = [
  { name: "Gaming", icon: "Gamepad2", color: "#36e7ff" },
  { name: "Cyber Security", icon: "ShieldCheck", color: "#8b5cf6" },
  { name: "Technology", icon: "Cpu", color: "#00ffc8" },
  { name: "AI & Robots", icon: "Bot", color: "#67e8f9" },
  { name: "Sci-Fi", icon: "Rocket", color: "#c084fc" },
  { name: "Space", icon: "Orbit", color: "#7dd3fc" },
  { name: "Science", icon: "Atom", color: "#22d3ee" },
  { name: "News & Current Affairs", icon: "Radio", color: "#60a5fa" },
  { name: "Coding", icon: "Code2", color: "#34d399" },
  { name: "Movies & Entertainment", icon: "Clapperboard", color: "#f472b6" },
  { name: "Sports", icon: "Trophy", color: "#facc15" },
  { name: "Education", icon: "GraduationCap", color: "#2dd4bf" },
  { name: "Business", icon: "BriefcaseBusiness", color: "#38bdf8" },
  { name: "Memes & Fun", icon: "Laugh", color: "#fb7185" },
  { name: "Mystery & Paranormal", icon: "Ghost", color: "#d946ef" },
  { name: "Social Media", icon: "Share2", color: "#a78bfa" },
  { name: "FutureTech", icon: "Sparkles", color: "#45ffd2" },
];

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export function formatDate(timestamp) {
  if (!timestamp) return "just now";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function getAvatar(user) {
  return user?.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.displayName || user?.email || "QH")}&backgroundColor=0f1025`;
}

export function getDisplayName(user) {
  return user?.displayName || user?.email?.split("@")[0] || "Anonymous";
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

export function toast(message, type = "info") {
  const stack = $(".toast-stack") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-stack" }));
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = message;
  stack.appendChild(item);
  requestAnimationFrame(() => item.classList.add("is-visible"));
  setTimeout(() => {
    item.classList.remove("is-visible");
    setTimeout(() => item.remove(), 280);
  }, 3400);
}

export function showSkeleton(container, count = 3) {
  container.innerHTML = Array.from({ length: count }, () => `
    <article class="question-card skeleton-card">
      <div class="skeleton-line wide"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </article>
  `).join("");
}

export function initParticles() {
  const canvas = $("#particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const particles = [];
  const pointer = { x: -1000, y: -1000 };
  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  const seed = () => {
    particles.length = 0;
    const total = Math.min(95, Math.floor(innerWidth / 14));
    for (let i = 0; i < total; i += 1) {
      particles.push({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 2 + 0.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        hue: Math.random() > 0.5 ? 188 : 268,
      });
    }
  };
  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > innerWidth) p.vx *= -1;
      if (p.y < 0 || p.y > innerHeight) p.vy *= -1;
      const dist = Math.hypot(pointer.x - p.x, pointer.y - p.y);
      if (dist < 120) {
        p.x += (p.x - pointer.x) * 0.004;
        p.y += (p.y - pointer.y) * 0.004;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, 0.74)`;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `hsla(${p.hue}, 95%, 65%, 0.7)`;
      ctx.fill();
      for (let j = i + 1; j < particles.length; j += 1) {
        const q = particles[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 115) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(67, 225, 255, ${0.12 - d / 1000})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    });
    requestAnimationFrame(draw);
  };
  addEventListener("resize", () => { resize(); seed(); });
  addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    document.documentElement.style.setProperty("--mouse-x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--mouse-y", `${event.clientY}px`);
  });
  resize();
  seed();
  draw();
}

export function initNav() {
  const toggle = $(".nav-toggle");
  const links = $(".nav-links");
  toggle?.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  $$(".nav-link").forEach((link) => {
    const current = location.pathname.split("/").pop() || "index.html";
    if (link.getAttribute("href") === current) link.classList.add("is-active");
  });
  const profileLink = $("[data-profile-link]");
  onAuthStateChanged(auth, (user) => {
    if (profileLink) profileLink.hidden = !user;
    $$("[data-auth-visible]").forEach((el) => { el.hidden = !user; });
    $$("[data-guest-visible]").forEach((el) => { el.hidden = !!user; });
  });
}

export function renderCategoryCards(container, onClick) {
  if (!container) return;
  container.innerHTML = categories.map((category) => `
    <button class="category-card" style="--accent:${category.color}" data-category="${escapeHtml(category.name)}">
      <i data-lucide="${category.icon}"></i>
      <span>${escapeHtml(category.name)}</span>
    </button>
  `).join("");
  container.addEventListener("click", (event) => {
    const card = event.target.closest(".category-card");
    if (card && onClick) onClick(card.dataset.category);
  });
  if (window.lucide) window.lucide.createIcons();
}

export function initTyping() {
  const el = $("[data-typing]");
  if (!el) return;
  const words = ["answers", "ideas", "debugging", "debates", "curiosity"];
  let word = 0;
  let char = 0;
  let deleting = false;
  const tick = () => {
    const current = words[word];
    char += deleting ? -1 : 1;
    el.textContent = current.slice(0, char);
    if (!deleting && char === current.length) deleting = true;
    if (deleting && char === 0) {
      deleting = false;
      word = (word + 1) % words.length;
    }
    setTimeout(tick, deleting ? 58 : 105);
  };
  tick();
}

export function initPageChrome() {
  initParticles();
  initNav();
  initTyping();
  document.body.classList.add("page-ready");
}
