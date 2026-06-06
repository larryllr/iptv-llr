import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogOut, Plus, RefreshCw, Search, Settings, Tv, Upload } from "lucide-react";
import "./styles.css";

type Channel = {
  id: string; name: string; category: string; logo?: string;
  sources: { url: string; protocol: string; label?: string }[];
  origin: "upstream" | "custom"; enabled: boolean; order: number; updatedAt: string; aliases: string[];
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body;
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const state = await api("/api/admin/state");
      setChannels(state.channels);
      setAuthenticated(true);
    } catch { setAuthenticated(false); }
  };
  useEffect(() => { void load(); }, []);
  const syncChannels = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/admin/sync", { method: "POST" });
      setMessage(`已同步 ${result.channelCount} 个频道`);
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => channels.filter((channel) => {
    const matchesQuery = channel.name.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "全部" || (filter === "自定义" ? channel.origin === "custom" : channel.category === filter);
    return matchesQuery && matchesFilter;
  }), [channels, query, filter]);
  const categories = ["全部", "自定义", ...Array.from(new Set(channels.map((item) => item.category))).slice(0, 6)];

  if (!authenticated) return <main className="login-shell">
    <section className="login-card">
      <div className="brand-mark"><Tv size={28}/></div>
      <h1>视界 IPTV</h1><p>登录频道管理中心</p>
      <form onSubmit={async (event) => {
        event.preventDefault(); setMessage("");
        try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); await load(); }
        catch (error) { setMessage((error as Error).message); }
      }}>
        <label>管理员密码</label>
        <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码"/>
        {message && <div className="error">{message}</div>}
        <button className="primary" type="submit">登录</button>
      </form>
    </section>
  </main>;

  return <div className="app-shell">
    <aside>
      <div className="brand"><div className="brand-mark"><Tv size={20}/></div><b>视界 IPTV</b></div>
      <nav><button className="active"><Tv/>频道管理</button><button><Upload/>导入播放源</button><button><Settings/>系统设置</button></nav>
      <button className="logout" onClick={async()=>{await api("/api/admin/logout",{method:"POST"});setAuthenticated(false);}}><LogOut/>退出登录</button>
    </aside>
    <main className="content">
      <header><div><h1>频道管理</h1><p>同步公共频道源，并维护你的自定义频道。</p></div>
        <div className="actions"><button onClick={syncChannels}><RefreshCw className={busy?"spin":""}/>立即同步</button><button className="primary"><Plus/>新增频道</button></div>
      </header>
      {message && <div className="notice">{message}</div>}
      <section className="toolbar"><div className="search"><Search/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索频道"/></div><div className="filters">{categories.map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</div></section>
      <section className="table-wrap">
        <div className="table-head"><span>频道</span><span>分类</span><span>来源</span><span>线路</span><span>状态</span></div>
        {visible.length ? visible.map(channel=><div className="channel-row" key={channel.id}>
          <div className="channel-name"><div className="logo">{channel.logo?<img src={channel.logo}/>:channel.name.slice(0,1)}</div><div><b>{channel.name}</b><small>{channel.id}</small></div></div>
          <span>{channel.category}</span><span>{channel.origin==="custom"?"自定义":"自动同步"}</span><span>{channel.sources.length} 条</span><span className={channel.enabled?"status on":"status"}>{channel.enabled?"已启用":"已停用"}</span>
        </div>):<div className="empty"><Tv/><b>暂无频道</b><span>点击“立即同步”获取公共频道源。</span></div>}
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
