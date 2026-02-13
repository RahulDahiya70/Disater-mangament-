import React, { useState } from "react";

function AIAgent({ state }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your AI assistant for disaster alerts. Ask me about alerts, disasters, resources, or type 'help' for guidance.", sender: "ai" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), text: input, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const response = generateResponse(input.toLowerCase(), state);
      const aiMsg = { id: Date.now() + 1, text: response, sender: "ai" };
      setMessages((prev) => [...prev, aiMsg]);
    }, 500);
  };

  const generateResponse = (query, state) => {
    if (query.includes("help")) {
      return "I can help with: 'alerts' - list active alerts, 'disasters' - list active disasters, 'resources' - show resource status, 'allocations' - show resource allocations.";
    }
    if (query.includes("alert")) {
      const activeAlerts = state.alerts.filter((a) => !a.acknowledged);
      if (activeAlerts.length === 0) return "No active alerts.";
      return activeAlerts.map((a) => `${a.level.toUpperCase()}: ${a.type} in ${a.location} - ${a.message}`).join("\n");
    }
    if (query.includes("disaster")) {
      const activeDisasters = state.disasters.filter((d) => d.status.toLowerCase() !== "resolved");
      if (activeDisasters.length === 0) return "No active disasters.";
      return activeDisasters.map((d) => `${d.type} in ${d.location} - Status: ${d.status}`).join("\n");
    }
    if (query.includes("resource")) {
      const resources = Object.values(state.resources);
      return resources.map((r) => `${r.emoji} ${r.label}: ${r.qty} ${r.unit}`).join("\n");
    }
    if (query.includes("allocation")) {
      if (state.allocations.length === 0) return "No resource allocations.";
      return state.allocations.map((a) => {
        const resource = state.resources[a.resourceKey];
        return `${resource.emoji} ${resource.label}: ${a.qty} allocated (${a.priority} priority)`;
      }).join("\n");
    }
    return "I'm sorry, I didn't understand that. Try 'help' for options.";
  };

  return (
    <>
      {!isOpen && (
        <button
          className="ai-agent-toggle"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
        >
          🤖
        </button>
      )}
      {isOpen && (
        <div className="ai-agent-chat">
          <div className="ai-agent-header">
            <span>AI Assistant</span>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>
          <div className="ai-agent-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                {msg.text.split("\n").map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ))}
          </div>
          <div className="ai-agent-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me about alerts..."
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}

export default AIAgent;
