import { useEffect, useState } from "react";
import { Video, Copy, Sparkles, Film, Check, Play, RefreshCw, FileText } from "lucide-react";
import { loadVideoStudio } from "./api";

interface CopyVariant {
  id: string;
  name: string;
  angle: string;
  tone: string;
  text: string;
  kpiEst: string;
}

interface VideoScene {
  num: number;
  visual: string;
  voiceover: string;
  duration: string;
}

interface RenderJob {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "rendering" | "ready";
  eta: string;
}

export function ContentStudio() {
  const [copyVariants] = useState<CopyVariant[]>([
    {
      id: "var-a",
      name: "Phiên bản A (Nhấn mạnh nỗi đau - Pain Point)",
      angle: "Đánh trúng tâm lý lo sợ tốn kém chi phí nhân sự và tụt hậu công nghệ của chủ doanh nghiệp nhỏ.",
      tone: "Cảnh báo, thúc giục, chuyên nghiệp",
      text: "🚨 DOANH NGHIỆP SME CỦA BẠN ĐÃ SẴN SÀNG CHO KỶ NGUYÊN AI CHƯA?\n\n82% đối thủ cạnh tranh của bạn đã bắt đầu ứng dụng AI Agent để tối ưu quy trình. Trong khi bạn vẫn đang loay hoay với chi phí nhân sự marketing ngày càng tăng, đội ngũ AI Agent của chúng tôi có thể tự động hóa 90% khâu viết content, tối ưu ad và chăm sóc leads 24/7 với chi phí rẻ hơn 70%.\n\n👉 Đừng để doanh nghiệp mình bị bỏ lại phía sau. Đăng ký tư vấn giải pháp AI miễn phí ngay!",
      kpiEst: "Dự kiến CTR: 3.4% - 4.1%"
    },
    {
      id: "var-b",
      name: "Phiên bản B (Nhấn mạnh lợi ích - Benefit Driven)",
      angle: "Tập trung vào hiệu suất làm việc 24/7 và khả năng X3 năng suất viết bài ngay lập tức.",
      tone: "Truyền cảm hứng, hiện đại, năng động",
      text: "🚀 X3 NĂNG SUẤT MARKETING VỚI CHI PHÍ TỐI ƯU 70% BẰNG AI AGENT!\n\nBạn muốn sở hữu một phòng marketing chuyên nghiệp làm việc không ngừng nghỉ? Đội ngũ 6 AI Agent Marketing được cấu hình sẵn sẽ giúp bạn:\n✓ Nghiên cứu đối thủ & quét xu hướng tự động mỗi ngày.\n✓ Soạn hàng chục bài viết A/B test chuẩn thương hiệu.\n✓ Thiết kế prompt visual và xuất bản bài đăng tự động.\n\n👉 Click ngay để trải nghiệm phòng AI Agent Marketing của riêng bạn!",
      kpiEst: "Dự kiến CTR: 4.2% - 4.9%"
    }
  ]);

  const [videoStoryboards] = useState<VideoScene[]>([
    {
      num: 1,
      visual: "Cận cảnh gương mặt một chủ shop mệt mỏi bên đống sổ sách, kim đồng hồ quay nhanh biểu thị đêm muộn.",
      voiceover: "Bạn mệt mỏi vì chi phí marketing cao nhưng không hiệu quả?",
      duration: "5s"
    },
    {
      num: 2,
      visual: "Hologram 6 luồng sáng đại diện cho 6 AI Agent hiện lên, bàn làm việc trở nên hiện đại, tràn ngập ánh sáng số.",
      voiceover: "Hãy làm quen với phòng AI Agent Marketing thế hệ mới.",
      duration: "10s"
    },
    {
      num: 3,
      visual: "Màn hình điện thoại hiển thị hàng trăm leads đổ về và các comment được tự động trả lời trong 2 giây.",
      voiceover: "Tự động hóa toàn bộ từ nghiên cứu, viết bài, thiết kế đến chốt lead.",
      duration: "10s"
    },
    {
      num: 4,
      visual: "Chủ shop mỉm cười thư thái uống cafe, màn hình hiển thị logo AI Marketing Command Center.",
      voiceover: "Tiết kiệm 70% chi phí. Đăng ký trải nghiệm ngay hôm nay!",
      duration: "5s"
    }
  ]);

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([
    { id: "job-1", name: "SME_Intro_Promo_Vertical.mp4", progress: 100, status: "ready", eta: "Finished" },
    { id: "job-2", name: "AI_Agent_Comparison_Square.mp4", progress: 68, status: "rendering", eta: "45s còn lại" },
    { id: "job-3", name: "Tiktok_Voiceover_Story.mp4", progress: 0, status: "queued", eta: "Chờ hàng" }
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [videoMode, setVideoMode] = useState<string>("");

  useEffect(() => {
    let active = true;
    loadVideoStudio().then((data) => {
      if (!active || !data || !data.assets?.length) return;
      setConnected(Boolean(data.connected));
      setVideoMode(data.mode);
      setRenderJobs(
        data.assets.map((asset, index) => {
          const status = asset.ready ? "ready" : asset.status === "processing" ? "rendering" : "queued";
          return {
            id: `${data.jobId}-${asset.type}-${index}`,
            name: `${asset.type.toUpperCase()} · ${data.title}`.slice(0, 46),
            progress: asset.ready ? 100 : asset.status === "processing" ? 60 : 0,
            status: status as RenderJob["status"],
            eta: asset.ready ? `Hoàn tất · ${asset.provider}` : asset.status === "processing" ? "Đang render" : "Chờ hàng"
          };
        })
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="view-grid">
      <div className="split" style={{ alignItems: "stretch" }}>
        {/* Left: A/B Testing Copy Variants */}
        <section className="panel" style={{ flex: 1.2 }}>
          <div className="panel-title" style={{ marginBottom: "1rem" }}>
            <FileText size={18} style={{ color: "var(--blue)" }} />
            <h2>A/B Testing Copywriting Variants</h2>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
            Content Creator Agent phác thảo các biến thể nội dung dựa trên ICP để tìm góc tiếp cận tối ưu nhất.
          </p>

          <div style={{ display: "grid", gap: "1rem" }}>
            {copyVariants.map((v) => (
              <div 
                key={v.id} 
                style={{ 
                  border: "1px solid var(--line)", 
                  padding: "1rem", 
                  borderRadius: "8px",
                  background: "#fff"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                  <div>
                    <h3 style={{ fontSize: "0.88rem", margin: 0 }}>{v.name}</h3>
                    <span style={{ fontSize: "0.68rem", color: "var(--muted)", display: "block", marginTop: "0.15rem" }}>
                      Tông giọng: <strong>{v.tone}</strong>
                    </span>
                  </div>
                  <button 
                    onClick={() => handleCopy(v.id, v.text)}
                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    {copiedId === v.id ? (
                      <>
                        <Check size={12} style={{ color: "var(--green)" }} /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy bài viết
                      </>
                    )}
                  </button>
                </div>

                <div style={{ fontSize: "0.76rem", color: "var(--muted)", background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "5px", marginBottom: "0.75rem", borderLeft: "2px solid var(--blue)" }}>
                  <strong>Góc tiếp cận:</strong> {v.angle}
                </div>

                <pre 
                  style={{ 
                    whiteSpace: "pre-wrap", 
                    fontFamily: "inherit", 
                    fontSize: "0.8rem", 
                    background: "#fafbfc", 
                    padding: "0.85rem", 
                    borderRadius: "6px", 
                    border: "1px solid var(--line)",
                    lineHeight: "1.5",
                    margin: 0
                  }}
                >
                  {v.text}
                </pre>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--teal)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Sparkles size={13} /> {v.kpiEst}
                  </span>
                  <span style={{ color: "var(--muted)" }}>Bởi Content Creator Agent</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Short Video Storyboard & Render Queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", flex: 0.9 }}>
          {/* Storyboard Card */}
          <section className="panel" style={{ flex: 1 }}>
            <div className="panel-title" style={{ marginBottom: "0.8rem" }}>
              <Film size={18} style={{ color: "var(--violet)" }} />
              <h2>Video Storyboard (30s Short-form)</h2>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              Phân cảnh chi tiết được soạn thảo tự động bởi Creative Director Agent.
            </p>

            <div style={{ display: "grid", gap: "0.6rem", maxHeight: "320px", overflowY: "auto", paddingRight: "0.25rem" }}>
              {videoStoryboards.map((scene) => (
                <div key={scene.num} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "0.6rem", fontSize: "0.78rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", color: "var(--violet)", marginBottom: "0.25rem" }}>
                    <span>Cảnh {scene.num}</span>
                    <span>{scene.duration}</span>
                  </div>
                  <div style={{ marginBottom: "0.3rem" }}>
                    <strong style={{ fontSize: "0.68rem", color: "var(--muted)", display: "block" }}>HÌNH ẢNH (PROMPT):</strong>
                    {scene.visual}
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.68rem", color: "var(--muted)", display: "block" }}>LỜI THOẠI (VOICEOVER):</strong>
                    <span style={{ fontStyle: "italic" }}>"{scene.voiceover}"</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Render Queue Card */}
          <section className="panel">
            <div className="panel-title" style={{ marginBottom: "0.8rem", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Video size={18} style={{ color: "var(--teal)" }} />
                <h2>Tiến độ Render Video AI</h2>
              </div>
              <span className={`badge ${connected ? "ready" : "muted"}`} style={{ fontSize: "0.62rem" }}>
                {connected ? `● ${videoMode === "provider" ? "Provider" : "Mock"}` : "○ Dữ liệu mẫu"}
              </span>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {renderJobs.map((job) => {
                let statusBadge = <span className="badge muted">Queued</span>;
                let color = "var(--line)";
                if (job.status === "rendering") {
                  statusBadge = <span className="badge high animate-pulse">Rendering</span>;
                  color = "var(--blue)";
                } else if (job.status === "ready") {
                  statusBadge = <span className="badge ready">Ready</span>;
                  color = "var(--green)";
                }

                return (
                  <div key={job.id} style={{ border: "1px solid var(--line)", padding: "0.65rem", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem", fontSize: "0.78rem" }}>
                      <strong>{job.name}</strong>
                      {statusBadge}
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${job.progress}%`, height: "100%", background: color, transition: "width 0.3s ease" }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)", minWidth: "28px", textAlign: "right" }}>
                        {job.progress}%
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      <span>Thời gian dự kiến: {job.eta}</span>
                      {job.status === "ready" && (
                        <span style={{ color: "var(--green)", fontWeight: "bold", cursor: "pointer" }}>
                          ▶ Xem Video
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
