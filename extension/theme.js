// Applies the saved theme before the page paints (classic script in <head>, so no flash). Light by default.
try { document.documentElement.dataset.theme = localStorage.getItem("rl-theme") || "light"; }
catch { document.documentElement.dataset.theme = "light"; }
