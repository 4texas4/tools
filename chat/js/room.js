// js/room.js
(function () {
  // Wait until supabase is ready and DOM loaded
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(async function () {
    // Parse params
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';
    const username = params.get('username') || '';

    const roomNameEl = document.getElementById('roomName');
    const usernameLabel = document.getElementById('usernameLabel');
    const messagesEl = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    roomNameEl.textContent = id || 'room';
    usernameLabel.textContent = username || '';

    if (!username) {
      document.body.innerHTML = `
        <div style="height:100vh; background-color:#12110b; color:#80c0ff; display:flex; justify-content:center; align-items:center; font-family:Arial, sans-serif; padding:20px; text-align:center;">
          <p>No username provided. Please go back and enter a username.</p>
        </div>
      `;
      return;
    }

    // helper: render messages
    function renderMessages(msgs) {
      messagesEl.innerHTML = '';
      if (!msgs || msgs.length === 0) {
        const p = document.createElement('p');
        p.style.color = '#91b0de';
        p.style.fontStyle = 'italic';
        p.textContent = 'No messages yet.';
        messagesEl.appendChild(p);
        return;
      }

      msgs.forEach(function (msg) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '20px';

        const who = document.createElement('div');
        who.style.fontSize = '0.85rem';
        who.style.fontWeight = 'bold';
        who.style.color = '#80c0ff';
        who.style.marginBottom = '3px';
        who.textContent = msg.username;

        const bubble = document.createElement('div');
        bubble.style.backgroundColor = '#1e2f5f';
        bubble.style.padding = '10px 14px';
        bubble.style.borderRadius = '6px';
        bubble.style.color = '#cce6ff';
        bubble.style.maxWidth = '80%';
        bubble.style.wordBreak = 'break-word';
        bubble.textContent = msg.text;

        wrap.appendChild(who);
        wrap.appendChild(bubble);
        messagesEl.appendChild(wrap);
      });

      const end = document.createElement('div');
      end.id = 'messages-end';
      messagesEl.appendChild(end);
      end.scrollIntoView({ behavior: 'smooth' });
    }

    // FETCH initial messages
    async function fetchMessages() {
      try {
        const { data, error } = await window.supabase
          .from('messages')
          .select('*')
          .eq('room', id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Fetch messages error:', error);
        } else {
          renderMessages(data);
        }
      } catch (err) {
        console.error(err);
      }
    }

    await fetchMessages();

    // subscribe to realtime inserts for this room
    let subscription = null;
    try {
      subscription = window.supabase
        .channel('public:messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room=eq.${id}`
          },
          (payload) => {
            // append message
            const msg = payload.new;
            const wrap = document.createElement('div');
            wrap.style.marginBottom = '20px';

            const who = document.createElement('div');
            who.style.fontSize = '0.85rem';
            who.style.fontWeight = 'bold';
            who.style.color = '#80c0ff';
            who.style.marginBottom = '3px';
            who.textContent = msg.username;

            const bubble = document.createElement('div');
            bubble.style.backgroundColor = '#1e2f5f';
            bubble.style.padding = '10px 14px';
            bubble.style.borderRadius = '6px';
            bubble.style.color = '#cce6ff';
            bubble.style.maxWidth = '80%';
            bubble.style.wordBreak = 'break-word';
            bubble.textContent = msg.text;

            wrap.appendChild(who);
            wrap.appendChild(bubble);
            messagesEl.appendChild(wrap);

            const end = document.getElementById('messages-end');
            if (end) end.scrollIntoView({ behavior: 'smooth' });
            else {
              const newEnd = document.createElement('div');
              newEnd.id = 'messages-end';
              messagesEl.appendChild(newEnd);
              newEnd.scrollIntoView({ behavior: 'smooth' });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Subscribe error:', err);
    }

    // send message
    async function sendMessage() {
      const text = (messageInput.value || '').trim();
      if (!text) return;

      try {
        const { error } = await window.supabase.from('messages').insert([
          {
            text: text,
            username: username,
            room: id,
          }
        ]);

        if (error) {
          console.error('Insert error:', error);
        } else {
          messageInput.value = '';
        }
      } catch (err) {
        console.error(err);
      }
    }

    // UI events
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });

    // cleanup on unload
    window.addEventListener('beforeunload', function () {
      if (subscription) {
        try {
          window.supabase.removeChannel(subscription);
        } catch (err) {
          // fallback: if removeChannel API differs, try unsubscribe
          console.warn('Could not remove channel with removeChannel:', err);
        }
      }
    });
  });
})();
