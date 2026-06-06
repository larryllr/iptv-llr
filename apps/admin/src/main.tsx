import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import {
  Expand, LogOut, Maximize, Plus, RefreshCw, Search, Settings,
  Tv, Upload, Volume2
} from "lucide-react";
import { resolvePage } from "./route";
import "./styles.css";

type Source = { url: string; protocol: string; label?: string; quality?: string };
type Channel = {
  id: string; name: string; category: string; logo?: string; sources: Source[];
  origin: "upstream" | "custom"; enabled: boolean; order: number;
  updatedAt: string; aliases: string[];
};

const trustedWebHosts = [
  "ali-m-l.cztv.com",
  "l.cztvcloud.com",
  "satellitepull.cnr.cn",
  "ls.qingting.fm",
  "p2hs.vzan.com",
  "epg.pw"
];
const placeholderPattern = /backup\.m3u8|testvideo|nosignal|no_signal|placeholder/i;

function webSourceScore(source: Source) {
  try {
    const host = new URL(source.url).hostname;
    const index = trustedWebHosts.indexOf(host);
    return index < 0 ? 100 : index;
  } catch {
    return 1000;
  }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body;
}

function PublicPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [message, setMessage] = useState("正在载入频道...");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hideDelay, setHideDelay] = useState(3);

  useEffect(() => {
    api("/api/v1/channels").then((result) => {
      const items = (result.channels as Channel[])
        .map((channel) => ({
          ...channel,
          sources: channel.sources.filter((source) =>
            source.protocol === "https" &&
            !/^https:\/\/iptv\.catvod\.com\//i.test(source.url)
          ).sort((a, b) => webSourceScore(a) - webSourceScore(b))
        }))
        .filter((channel) => channel.sources.length > 0)
        .sort((a, b) => {
          const score = webSourceScore(a.sources[0]) - webSourceScore(b.sources[0]);
          return score || a.order - b.order;
        });
      setChannels(items);
      setSelected(items[0] ?? null);
      setMessage(items.length ? "" : "当前源没有浏览器兼容线路，请使用客户端");
    }).catch(() => setMessage("频道服务暂不可用，请稍后刷新"));
  }, []);

  useEffect(() => {
    const source = selected?.sources[sourceIndex];
    const video = videoRef.current;
    if (!source || !video) return;
    setMessage("正在连接直播源...");
    let hls: Hls | undefined;
    const failover = () => {
      if (sourceIndex + 1 < selected.sources.length) {
        setMessage(`线路 ${sourceIndex + 1} 不可用，正在自动切换...`);
        setSourceIndex((current) => current + 1);
      } else {
        setMessage("该频道当前所有线路均不可用，请尝试其他频道");
      }
    };
    if ((source.protocol === "http" || source.protocol === "https") && Hls.isSupported()) {
      const playbackUrl = source.protocol === "https"
        ? source.url
        : `/api/v1/stream/${selected.id}/${sourceIndex}`;
      void fetch(playbackUrl).then(async (response) => {
        const manifest = await response.text();
        if (!response.ok || !manifest.includes("#EXTM3U") || placeholderPattern.test(manifest)) {
          failover();
          return;
        }
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setMessage("");
          void video.play().catch(() => setMessage("点击画面开始播放"));
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) failover();
        });
      }).catch(failover);
    } else if (source.protocol === "http" || source.protocol === "https") {
      video.src = `/api/v1/stream/${selected.id}/${sourceIndex}`;
      void video.play().then(() => setMessage("")).catch(() => setMessage("点击画面开始播放"));
    } else {
      setMessage(`${source.protocol.toUpperCase()} 需要 Windows 或 Android 客户端播放`);
    }
    return () => { hls?.destroy(); video.removeAttribute("src"); video.load(); };
  }, [selected, sourceIndex]);

  const wakeControls = () => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), hideDelay * 1000);
  };
  useEffect(() => { wakeControls(); return () => window.clearTimeout(hideTimer.current); }, [hideDelay]);

  const categories = ["全部", ...Array.from(new Set(channels.map((item) => item.category)))];
  const visible = useMemo(() => channels.filter((item) =>
    (category === "全部" || item.category === category) &&
    item.name.toLowerCase().includes(query.toLowerCase())
  ), [channels, category, query]);

  return <main
    className={`player-page ${controlsVisible ? "" : "controls-hidden"}`}
    ref={shellRef}
    onMouseMove={wakeControls}
    onTouchStart={wakeControls}
    onKeyDown={wakeControls}
  >
    <video ref={videoRef} className="video-stage" playsInline onClick={() => {
      const video = videoRef.current;
      if (!video) return;
      video.paused ? void video.play() : video.pause();
    }}/>
    <div className="video-shade"/>
    <header className="player-header player-ui">
      <div className="player-brand"><span><Tv/></span><b>视界 IPTV</b></div>
      <div className="player-tools">
        <label className="delay-setting">控件隐藏
          <select value={hideDelay} onChange={(event) => setHideDelay(Number(event.target.value))}>
            <option value={3}>3 秒</option><option value={5}>5 秒</option><option value={10}>10 秒</option>
          </select>
        </label>
        <a href="/admin" className="admin-link"><Settings/>管理</a>
      </div>
    </header>
    <section className="now-playing player-ui">
      <div className="live-dot"/> <span>正在直播</span>
      <h1>{selected?.name ?? "视界 IPTV"}</h1>
      <p>{selected ? `${selected.category} · ${selected.sources.length} 条网页兼容线路` : "选择频道开始观看"}</p>
      {message && <div className="play-message">{message}</div>}
    </section>
    <section className="player-bottom player-ui">
      <div className="player-control-row">
        <div className="source-tabs">{selected?.sources.map((source, index) =>
          <button className={index === sourceIndex ? "selected" : ""} key={`${source.url}-${index}`}
            onClick={() => setSourceIndex(index)}>{source.label || source.quality || `线路 ${index + 1}`}</button>)}
        </div>
        <div className="media-buttons"><Volume2/><button aria-label="网页全屏" onClick={() => void shellRef.current?.requestFullscreen()}><Maximize/></button></div>
      </div>
      <div className="channel-tools">
        <div className="search public-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索频道"/></div>
        <div className="category-tabs">{categories.slice(0, 10).map((item) =>
          <button key={item} className={item === category ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </div>
      <div className="channel-rail">
        {visible.map((channel) => <button key={channel.id} className={selected?.id === channel.id ? "channel-card active-channel" : "channel-card"}
          onClick={() => { setSelected(channel); setSourceIndex(0); }}>
          <div className="channel-card-logo">{channel.logo ? <img src={channel.logo}/> : channel.name.slice(0, 2)}</div>
          <b>{channel.name}</b><span>{channel.category}</span>
        </button>)}
      </div>
    </section>
  </main>;
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    try { const state = await api("/api/admin/state"); setChannels(state.channels); setAuthenticated(true); }
    catch { setAuthenticated(false); }
  };
  useEffect(() => { void load(); }, []);
  const syncChannels = async () => {
    setBusy(true); setMessage("");
    try { const result = await api("/api/admin/sync", { method: "POST" }); setMessage(`已同步 ${result.channelCount} 个频道`); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const visible = useMemo(() => channels.filter((channel) =>
    channel.name.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "全部" || (filter === "自定义" ? channel.origin === "custom" : channel.category === filter))
  ), [channels, query, filter]);
  const categories = ["全部", "自定义", ...Array.from(new Set(channels.map((item) => item.category))).slice(0, 6)];

  if (!authenticated) return <main className="login-shell">
    <a className="back-player" href="/">返回播放</a>
    <section className="login-card"><div className="brand-mark"><Tv size={28}/></div>
      <h1>视界 IPTV</h1><p>登录频道管理中心</p>
      <form onSubmit={async (event) => { event.preventDefault(); setMessage("");
        try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); await load(); }
        catch (error) { setMessage((error as Error).message); }}}>
        <label>管理员密码</label><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码"/>
        {message && <div className="error">{message}</div>}<button className="primary" type="submit">登录</button>
      </form>
    </section>
  </main>;

  return <div className="app-shell"><aside><div className="brand"><div className="brand-mark"><Tv size={20}/></div><b>视界 IPTV</b></div>
    <nav><button className="active"><Tv/>频道管理</button><button><Upload/>导入播放源</button><button><Settings/>系统设置</button></nav>
    <a className="view-player" href="/"><Expand/>打开播放页</a>
    <button className="logout" onClick={async()=>{await api("/api/admin/logout",{method:"POST"});setAuthenticated(false);}}><LogOut/>退出登录</button></aside>
    <main className="content"><header><div><h1>频道管理</h1><p>同步公共频道源，并维护你的自定义频道。</p></div>
      <div className="actions"><button onClick={syncChannels}><RefreshCw className={busy?"spin":""}/>立即同步</button><button className="primary"><Plus/>新增频道</button></div></header>
      {message && <div className="notice">{message}</div>}<section className="toolbar"><div className="search"><Search/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索频道"/></div>
      <div className="filters">{categories.map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</div></section>
      <section className="table-wrap"><div className="table-head"><span>频道</span><span>分类</span><span>来源</span><span>线路</span><span>状态</span></div>
      {visible.length ? visible.map(channel=><div className="channel-row" key={channel.id}><div className="channel-name"><div className="logo">{channel.logo?<img src={channel.logo}/>:channel.name.slice(0,1)}</div><div><b>{channel.name}</b><small>{channel.id}</small></div></div>
        <span>{channel.category}</span><span>{channel.origin==="custom"?"自定义":"自动同步"}</span><span>{channel.sources.length} 条</span><span className={channel.enabled?"status on":"status"}>{channel.enabled?"已启用":"已停用"}</span></div>)
        :<div className="empty"><Tv/><b>暂无频道</b><span>点击“立即同步”获取公共频道源。</span></div>}</section>
    </main></div>;
}

const page = resolvePage(window.location.pathname);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{page === "admin" ? <AdminApp/> : <PublicPlayer/>}</React.StrictMode>
);
