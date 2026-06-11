const translations = {
  en: {
    "brand.sub": "Local device wall",
    "nav.quickstart": "Quickstart",
    "nav.architecture": "Architecture",
    "nav.deploy": "Deploy",
    "nav.release": "Release",
    "hero.eyebrow": "Local-first Android mirroring",
    "hero.title": "Distributed phones. One live Hub.",
    "hero.lede":
      "pura turns developer-owned USB phones into a shared LAN device wall. ADB stays local; Agents initiate control and video channels to the Hub.",
    "hero.primary": "Quickstart",
    "hero.secondary": "Architecture",
    "showcase.title": "Product preview",
    "showcase.badge": "Hub + Agents",
    "showcase.alt": "pura Hub dashboard with Android devices and agent network",
    "signal.title": "Hub online",
    "signal.meta": "Agents reporting",
    "quick.eyebrow": "Quickstart",
    "quick.title": "Hub on Docker. Agents by CLI.",
    "quick.body": "A minimal path from scattered USB devices to a browsable Android wall.",
    "quick.step1": "Run Hub",
    "quick.step2": "Register Agent",
    "quick.step3": "Publish in web UI",
    "arch.eyebrow": "Hub / Agent architecture",
    "arch.title": "Shared visibility without shared USB.",
    "arch.body":
      "The Hub owns discovery and session routing. Agents own physical devices, ADB, video capture, and local tap execution, then push control and video streams back to the Hub.",
    "arch.hubTitle": "Browser device wall",
    "arch.hubBody": "Online inventory, session routing, video proxy, tap proxy",
    "arch.agentTitle": "Developer laptop",
    "arch.agentBody": "ADB devices, screenrecord, local tap execution",
    "deploy.eyebrow": "Deployment",
    "deploy.title": "A small service for the office LAN.",
    "deploy.body": "The Hub runs as a containerized control plane. Agents stay native beside the hardware and initiate outbound connections.",
    "deploy.tabCompose": "Compose",
    "deploy.tabImage": "GHCR image",
    "deploy.tabNode": "Node",
    "detail.installTitle": "Lightweight Agent registration.",
    "detail.installKicker": "Install",
    "detail.installBody": "npx launches a local Agent, stores Hub settings, and reports authorized ADB devices.",
    "detail.controlTitle": "Coordinate-accurate tap routing.",
    "detail.controlKicker": "Control",
    "detail.controlBody": "The Hub receives browser actions and sends them through the Agent's outbound control channel.",
    "detail.safetyTitle": "LAN boundary by default.",
    "detail.safetyKicker": "Safety",
    "detail.safetyBody": "Traffic stays between Hub, Agents, and browsers on the local network. No cloud relay or public tunnel is part of the path.",
    "release.eyebrow": "Open-source distribution",
    "release.title": "CLI on npm. Hub image on GHCR.",
    "release.body": "pura ships as the pura-cli package and a containerized Hub, with release automation for tagged versions.",
    footer: "Local-first Android mirroring for distributed device labs.",
    copy: "Copy",
    copied: "Copied",
    select: "Select"
  },
  zh: {
    "brand.sub": "本地设备墙",
    "nav.quickstart": "快速开始",
    "nav.architecture": "架构",
    "nav.deploy": "部署",
    "nav.release": "发布",
    "hero.eyebrow": "本地优先的 Android 真机镜像",
    "hero.title": "分散的真机，一个实时 Hub。",
    "hero.lede": "pura 将研发手上的 USB 真机汇成局域网设备墙。ADB 留在本机，Agent 主动向 Hub 建立控制与视频通道。",
    "hero.primary": "快速开始",
    "hero.secondary": "架构模型",
    "showcase.title": "产品预览",
    "showcase.badge": "Hub + Agent",
    "showcase.alt": "pura Hub 仪表盘、安卓设备和 Agent 网络",
    "signal.title": "Hub 在线",
    "signal.meta": "Agent 上报中",
    "quick.eyebrow": "快速开始",
    "quick.title": "Hub 用 Docker，Agent 用 CLI。",
    "quick.body": "从分散 USB 真机到可浏览 Android 设备墙，只保留必要路径。",
    "quick.step1": "运行 Hub",
    "quick.step2": "注册 Agent",
    "quick.step3": "网页发布",
    "arch.eyebrow": "Hub / Agent 架构",
    "arch.title": "共享视野，不共享 USB。",
    "arch.body": "Hub 负责发现与会话路由；Agent 负责物理设备、ADB、视频采集与本地点击执行，并主动把控制与视频流推回 Hub。",
    "arch.hubTitle": "浏览器设备墙",
    "arch.hubBody": "在线清单、会话路由、视频代理、点击代理",
    "arch.agentTitle": "研发电脑",
    "arch.agentBody": "ADB 设备、screenrecord、本地点击执行",
    "deploy.eyebrow": "部署",
    "deploy.title": "面向办公局域网的小型服务。",
    "deploy.body": "Hub 作为容器化控制面运行；Agent 原生运行在硬件旁边，并主动发起外连。",
    "deploy.tabCompose": "Compose",
    "deploy.tabImage": "GHCR 镜像",
    "deploy.tabNode": "Node",
    "detail.installTitle": "Agent 注册保持轻量。",
    "detail.installKicker": "安装",
    "detail.installBody": "npx 启动本地 Agent，保存 Hub 配置，并上报已授权的 ADB 设备。",
    "detail.controlTitle": "坐标准确的点击路由。",
    "detail.controlKicker": "控制",
    "detail.controlBody": "Hub 接收浏览器操作，并通过 Agent 主动建立的控制通道下发执行。",
    "detail.safetyTitle": "默认以局域网为边界。",
    "detail.safetyKicker": "安全边界",
    "detail.safetyBody": "流量只在 Hub、Agent 与浏览器之间留在本地网络，不引入云端中继或公网隧道。",
    "release.eyebrow": "开源分发",
    "release.title": "CLI 发布到 npm，Hub 镜像发布到 GHCR。",
    "release.body": "pura 以 pura-cli 包和容器化 Hub 分发，tag 版本触发发布自动化。",
    footer: "面向分布式设备实验室的本地优先 Android 真机镜像。",
    copy: "复制",
    copied: "已复制",
    select: "选择"
  }
};

let activeLanguage = localStorage.getItem("pura-language") || (navigator.language.startsWith("zh") ? "zh" : "en");

function translatePage(language) {
  activeLanguage = translations[language] ? language : "en";
  const dictionary = translations[activeLanguage];
  document.documentElement.lang = activeLanguage === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n") || "";
    if (dictionary[key]) element.textContent = dictionary[key];
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    const rules = (element.getAttribute("data-i18n-attr") || "").split(",");
    rules.forEach((rule) => {
      const [attribute, key] = rule.split(":").map((item) => item.trim());
      if (attribute && key && dictionary[key]) element.setAttribute(attribute, dictionary[key]);
    });
  });

  document.querySelectorAll(".language-option").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-lang") === activeLanguage);
  });
}

document.querySelectorAll(".language-option").forEach((button) => {
  button.addEventListener("click", () => {
    const language = button.getAttribute("data-lang") || "en";
    localStorage.setItem("pura-language", language);
    translatePage(language);
  });
});

translatePage(activeLanguage);

const copyButtons = document.querySelectorAll("[data-copy]");

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy") || "";

    try {
      await navigator.clipboard.writeText(value);
      button.textContent = translations[activeLanguage].copied;
      button.classList.add("copied");
      window.setTimeout(() => {
        button.textContent = translations[activeLanguage].copy;
        button.classList.remove("copied");
      }, 1300);
    } catch {
      button.textContent = translations[activeLanguage].select;
    }
  });
});

const tabs = document.querySelectorAll("[data-tab]");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.getAttribute("data-tab");

    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `${name}-panel`);
    });
  });
});

const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href") || ""))
  .filter(Boolean);

const navObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  },
  { rootMargin: "-18% 0px -66% 0px", threshold: [0.1, 0.35, 0.7] }
);

sections.forEach((section) => navObserver.observe(section));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 35, 280)}ms`;
  revealObserver.observe(item);
});

const hero = document.querySelector(".hero");
const showcaseCard = document.querySelector(".showcase-card");

if (hero && showcaseCard && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    showcaseCard.style.setProperty("--tilt-x", `${y * -2.4}deg`);
    showcaseCard.style.setProperty("--tilt-y", `${x * 3.2}deg`);
  });

  hero.addEventListener("pointerleave", () => {
    showcaseCard.style.removeProperty("--tilt-x");
    showcaseCard.style.removeProperty("--tilt-y");
  });
}
