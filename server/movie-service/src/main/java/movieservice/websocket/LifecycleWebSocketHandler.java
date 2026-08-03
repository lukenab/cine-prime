package movieservice.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Broadcast-only lifecycle channel. Payloads contain IDs/statuses only, never protected data. */
@Component
public class LifecycleWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public void broadcast(String payload) {
        sessions.removeIf(session -> {
            if (!session.isOpen()) {
                return true;
            }
            try {
                synchronized (session) {
                    session.sendMessage(new TextMessage(payload));
                }
                return false;
            } catch (Exception ignored) {
                return true;
            }
        });
    }
}
