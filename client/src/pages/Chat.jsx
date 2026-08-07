import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await api.get('/communications/messages');
        setMessages(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const response = await api.post('/communications/messages', { message: messageText.trim() });
      setMessages((prev) => [response.data.data, ...prev]);
      setMessageText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="mt-2 text-slate-600">Send a message to the administration and review recent chat history.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-xl">
        <label htmlFor="message" className="block text-sm font-medium text-slate-700">New message</label>
        <textarea
          id="message"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          rows="4"
          className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="What do you need help with?"
        />
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center justify-center rounded-3xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>

      <div className="grid gap-4">
        {messages.length ? messages.map((message) => (
          <article key={message._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{message.sender.name || message.sender.email}</h2>
                <p className="text-sm text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{message.status}</span>
            </div>
            <p className="mt-4 text-slate-600 whitespace-pre-line">{message.message}</p>
          </article>
        )) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No messages yet. Send the first one.</div>
        )}
      </div>
    </section>
  );
};

export default Chat;
