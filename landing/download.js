/**
 * OS-aware download buttons — resolves the latest foldnize-app-v* GitHub Release
 * and links each platform to the matching installer (.dmg / .exe / .AppImage).
 *
 * Download counts per asset are on the GitHub Release page.
 */
(function () {
  const GITHUB_REPO = "MatheusChignolli/foldnize";
  const RELEASE_TAG_PREFIX = "foldnize-app-v";
  const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

  function pickAsset(assets, platform) {
    const matchers = {
      macos: (name) => name.endsWith(".dmg"),
      windows: (name) => name.endsWith(".exe"),
      linux: (name) => name.endsWith(".AppImage"),
    };
    return assets.find((asset) => matchers[platform](asset.name));
  }

  function detectPlatform() {
    const ua = navigator.userAgent;
    const platform = navigator.platform || "";

    if (/Mac|iPhone|iPad|iPod/i.test(platform) || /Macintosh/i.test(ua)) {
      return "macos";
    }
    if (/Win/i.test(platform) || /Windows/i.test(ua)) {
      return "windows";
    }
    if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
      return "linux";
    }
    return null;
  }

  const primary = document.getElementById("download-primary");
  const detected = document.getElementById("download-detected-os");
  const links = document.querySelectorAll("[data-download-platform]");

  const os = detectPlatform();
  const labels = {
    macos: "macOS",
    windows: "Windows",
    linux: "Linux",
  };

  function setFallbackLinks() {
    if (primary) primary.href = RELEASES_PAGE;
    links.forEach((link) => {
      link.href = RELEASES_PAGE;
    });
  }

  async function resolveDownloadLinks() {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
        { headers: { Accept: "application/vnd.github+json" } },
      );

      if (!response.ok) throw new Error(`GitHub API ${response.status}`);

      const releases = await response.json();
      const appRelease = releases.find((release) =>
        release.tag_name.startsWith(RELEASE_TAG_PREFIX),
      );

      if (!appRelease?.assets?.length) throw new Error("No app release assets");

      const urls = {};
      for (const platform of ["macos", "windows", "linux"]) {
        const asset = pickAsset(appRelease.assets, platform);
        if (asset) urls[platform] = asset.browser_download_url;
      }

      if (primary && os && urls[os]) {
        primary.href = urls[os];
        primary.textContent = "";
        const label = document.createElement("span");
        label.textContent = `Download for ${labels[os]}`;
        primary.appendChild(label);

        const arrow = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        arrow.setAttribute("viewBox", "0 0 16 16");
        arrow.setAttribute("width", "14");
        arrow.setAttribute("height", "14");
        arrow.setAttribute("fill", "none");
        arrow.setAttribute("stroke", "currentColor");
        arrow.setAttribute("stroke-width", "2");
        arrow.setAttribute("stroke-linecap", "round");
        arrow.setAttribute("stroke-linejoin", "round");
        arrow.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", "M5 3l5 5-5 5");
        arrow.appendChild(path);
        primary.appendChild(arrow);
      } else if (primary) {
        primary.href = RELEASES_PAGE;
      }

      links.forEach((link) => {
        const platform = link.getAttribute("data-download-platform");
        if (urls[platform]) link.href = urls[platform];
        else link.href = RELEASES_PAGE;
      });
    } catch {
      setFallbackLinks();
    }
  }

  if (detected && os) {
    detected.textContent = `Detected: ${labels[os]}`;
  }

  setFallbackLinks();
  resolveDownloadLinks();
})();
