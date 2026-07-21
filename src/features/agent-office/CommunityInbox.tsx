import { useEffect, useState } from "react";
import { MessageCircle, Check, X, ShieldAlert, Sparkles, Send, Inbox, User, Filter, AlertTriangle } from "lucide-react";
import { loadCommunity } from "./api";
import type { TriagedMessageView } from "./types";

interface MessageItem {
  id: string;
  author: string;
  platform: string;
  content: string;
  type: "lead" | "faq" | "spam" | "complaint";
  reply: string;
  status: "pending" | "sent" | "ignored";
  time: string;
  score?: number; // Lead score (e.g. 85/100)
}

export function CommunityInbox() {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "msg-1",
      author: "Lê Minh Tuấn",
      platform: "Facebook Post Comment",
      content: "Dịch vụ AI Agent này chi phí cài đặt ban đầu thế nào shop? Có hỗ trợ xuất hóa đơn VAT không?",
      type: "faq",
      reply: "Chào bạn Lê Minh Tuấn, gói cài đặt hệ thống AI Agent cơ bản cho SME có giá từ 4.900.000 VNĐ (thanh toán một lần) và hoàn toàn hỗ trợ xuất hóa đơn VAT đầy đủ cho doanh nghiệp của bạn nhé.",
      status: "pending",
      time: "10 phút trước"
    },
    {
      id: "msg-2",
      author: "Nguyễn Hương Giang",
      platform: "Messenger Inbox",
      content: "Tôi bên công ty Logistic lớn ở Quận 1, muốn đặt lịch tư vấn trực tiếp 1-1 để demo luồng tự động hóa phễu lead.",
      type: "lead",
      reply: "Chào chị Hương Giang, rất hân hạnh! Trợ lý AI đã ghi nhận nhu cầu của chị. Chị có thể chọn khung giờ phù hợp trực tiếp tại link: calendly.com/ai-marketing/consulting để chuyên viên bên em hỗ trợ demo nhé.",
      status: "pending",
      time: "25 phút trước",
      score: 95
    },
    {
      id: "msg-3",
      author: "Spam Bot 99",
      platform: "Facebook Post Comment",
      content: "Bán token quảng cáo BM cổ kháng xịn giá rẻ sập sàn liên hệ zalo 0903xxxxxx !!!",
      type: "spam",
      reply: "",
      status: "pending",
      time: "1 giờ trước"
    },
    {
      id: "msg-4",
      author: "Trần Văn Hùng",
      platform: "Facebook Post Comment",
      content: "Tôi cấu hình khóa API OpenAI trên dashboard của mình mà hệ thống cứ báo lỗi 500.",
      type: "complaint",
      reply: "Chào anh Hùng, rất tiếc vì sự cố anh gặp phải. Em đã chuyển tiếp log kỹ thuật đến đội hỗ trợ. Chuyên viên sẽ nhắn tin trực tiếp hỗ trợ anh cấu hình lại API ngay trong ít phút nữa.",
      status: "pending",
      time: "2 giờ trước"
    }
  ]);

  const [selectedId, setSelectedId] = useState<string>("msg-2");
  const [filterType, setFilterType] = useState<"all" | "lead" | "faq" | "complaint" | "spam">("all");
  const [draftReply, setDraftReply] = useState<string>("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    loadCommunity().then((data) => {
      if (!active || !data || !data.messages?.length) return;
      setConnected(Boolean(data.connected));
      setMessages(
        data.messages.map((message: TriagedMessageView) => ({
          id: message.id,
          author: "Khách hàng (ẩn danh)",
          platform: message.channel === "comment" ? "Facebook Post Comment" : "Messenger Inbox",
          content: message.redactedText,
          type: message.category === "general" ? "faq" : message.category,
          reply: message.suggestedReply ?? "",
          status: "pending" as const,
          time: new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          score: message.leadScore
        }))
      );
      setSelectedId(data.messages[0].id);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeMessage = messages.find((m) => m.id === selectedId) || messages[0];

  // Set initial draft text when active message changes
  const handleSelect = (msg: MessageItem) => {
    setSelectedId(msg.id);
    setDraftReply(msg.reply);
  };

  const handleSend = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, reply: draftReply, status: "sent" as const } : msg))
    );
  };

  const handleIgnore = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, status: "ignored" as const } : msg))
    );
  };

  const filteredMessages = messages.filter(
    (m) => filterType === "all" || m.type === filterType
  );

  const pendingCount = messages.filter((m) => m.status === "pending").length;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "lead": return "Lead tiềm năng";
      case "faq": return "Câu hỏi FAQ";
      case "spam": return "Spam";
      case "complaint": return "Khiếu nại";
      default: return type;
    }
  };

  return (
    <section className="panel" style={{ padding: "1.2rem", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="panel-title" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <MessageCircle size={20} style={{ color: "var(--teal)" }} />
          <h2>Hộp thư Phân loại & Chăm sóc Leads (Community Inbox)</h2>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <span className={`badge ${connected ? "ready" : "muted"}`} style={{ fontSize: "0.62rem" }}>
            {connected ? "● Realtime" : "○ Dữ liệu mẫu"}
          </span>
          <span className="badge urgent">{pendingCount} tin chờ duyệt</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1.2rem", flex: 1, minHeight: "450px" }}>
        {/* Left column: List of messages */}
        <div style={{ borderRight: "1px solid var(--line)", paddingRight: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
            {(["all", "lead", "faq", "complaint", "spam"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.7rem",
                  background: filterType === t ? "var(--teal)" : "transparent",
                  color: filterType === t ? "#fff" : "var(--muted)",
                  borderColor: filterType === t ? "var(--teal)" : "var(--line)"
                }}
              >
                {t === "all" ? "Tất cả" : getTypeLabel(t)}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", flex: 1, maxHeight: "380px" }}>
            {filteredMessages.map((msg) => {
              const isSelected = msg.id === selectedId;
              return (
                <div
                  key={msg.id}
                  onClick={() => handleSelect(msg)}
                  style={{
                    border: isSelected ? "1.5px solid var(--teal)" : "1px solid var(--line)",
                    background: isSelected ? "#f0fdfa" : "#fff",
                    padding: "0.65rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "0.8rem", color: "var(--ink)" }}>{msg.author}</strong>
                    <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{msg.time}</span>
                  </div>

                  <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    "{msg.content}"
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{msg.platform}</span>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {msg.score && (
                        <span className="badge ready" style={{ fontSize: "0.58rem" }}>
                          Score: {msg.score}
                        </span>
                      )}
                      <span className={`badge ${msg.type === "lead" ? "ready" : msg.type === "spam" ? "urgent" : "high"}`} style={{ fontSize: "0.58rem" }}>
                        {getTypeLabel(msg.type)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredMessages.length === 0 && (
              <div style={{ display: "grid", placeItems: "center", height: "150px", border: "1px dashed var(--line)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.78rem" }}>
                Không tìm thấy tương tác nào
              </div>
            )}
          </div>
        </div>

        {/* Right column: Conversation Details & AI Draft Editor */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {activeMessage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
              {/* Message Header */}
              <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{activeMessage.author}</h3>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      Kênh: {activeMessage.platform} • {activeMessage.time}
                    </span>
                  </div>
                  <span className={`badge ${activeMessage.type === "lead" ? "ready" : "high"}`} style={{ fontSize: "0.68rem" }}>
                    {getTypeLabel(activeMessage.type).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Customer Message bubble */}
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0", display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: "bold", color: "var(--muted)" }}>
                  {activeMessage.author[0]}
                </div>
                <div style={{ background: "#f1f5f9", padding: "0.75rem", borderRadius: "0 12px 12px 12px", fontSize: "0.82rem", maxWidth: "85%", color: "var(--ink)" }}>
                  {activeMessage.content}
                </div>
              </div>

              {/* AI Draft Response & Editor */}
              {activeMessage.status === "pending" ? (
                activeMessage.type === "spam" ? (
                  <div style={{ border: "1px solid #fecaca", background: "#fef2f2", padding: "0.85rem", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <AlertTriangle size={16} style={{ color: "var(--red)", marginTop: "0.15rem" }} />
                    <div>
                      <strong style={{ display: "block", fontSize: "0.8rem", color: "var(--red)" }}>Tương tác được phân loại là SPAM</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                        Spam Bot hoặc bài đăng quảng cáo rác. Không có câu trả lời đề xuất nào được tạo. Bạn nên bỏ qua hoặc chặn tài khoản này.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--blue)" }}>
                      <Sparkles size={14} />
                      <strong>CÂU TRẢ LỜI ĐỀ XUẤT BỞI AI (DRAFT):</strong>
                    </div>

                    <textarea
                      value={draftReply !== undefined ? draftReply : activeMessage.reply}
                      onChange={(e) => setDraftReply(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: "100px",
                        padding: "0.6rem",
                        fontSize: "0.8rem",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        fontFamily: "inherit",
                        lineHeight: "1.4"
                      }}
                      placeholder="Nhập câu trả lời hoặc chỉnh sửa câu trả lời nháp từ AI..."
                    />
                  </div>
                )
              ) : (
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", alignSelf: "flex-end", flexDirection: "row-reverse" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--teal)", display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: "bold", color: "#fff" }}>
                    AI
                  </div>
                  <div style={{ background: activeMessage.status === "sent" ? "#e0f2fe" : "#f1f5f9", padding: "0.75rem", borderRadius: "12px 0 12px 12px", fontSize: "0.82rem", maxWidth: "85%", color: "var(--ink)", textAlign: "right" }}>
                    {activeMessage.status === "sent" ? (
                      <>
                        <span style={{ fontSize: "0.68rem", color: "var(--blue)", fontWeight: "bold", display: "block", marginBottom: "0.25rem" }}>
                          ĐÃ DUYỆT GỬI LÊN FB PAGE
                        </span>
                        {activeMessage.reply}
                      </>
                    ) : (
                      <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Tương tác này đã bị bỏ qua / spam</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {activeMessage.status === "pending" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid var(--line)", paddingTop: "0.85rem", marginTop: "auto" }}>
                  <button
                    onClick={() => handleIgnore(activeMessage.id)}
                    style={{
                      padding: "0.45rem 0.8rem",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem"
                    }}
                  >
                    <X size={14} /> Bỏ qua
                  </button>
                  {activeMessage.type !== "spam" && (
                    <button
                      onClick={() => handleSend(activeMessage.id)}
                      style={{
                        padding: "0.45rem 0.8rem",
                        fontSize: "0.8rem",
                        background: "var(--teal)",
                        color: "#fff",
                        borderColor: "var(--teal)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem"
                      }}
                    >
                      <Send size={14} /> Duyệt gửi phản hồi
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", placeItems: "center", flex: 1, color: "var(--muted)", fontSize: "0.85rem" }}>
              Chọn một hội thoại ở danh sách bên trái để kiểm tra chi tiết
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
