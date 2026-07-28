package movieservice.websocket;

import java.net.URI;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class SeatInventoryWebSocketHandler extends TextWebSocketHandler {

    private final ConcurrentHashMap<Long, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long showtimeId = showtimeId(session.getUri());
        if (showtimeId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        session.getAttributes().put("showtimeId", showtimeId);
        sessions.computeIfAbsent(showtimeId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object value = session.getAttributes().get("showtimeId");
        if (value instanceof Long showtimeId) {
            Set<WebSocketSession> values = sessions.get(showtimeId);
            if (values != null) {
                values.remove(session);
                if (values.isEmpty()) {
                    sessions.remove(showtimeId);
                }
            }
        }
    }

    public void broadcast(Long showtimeId, String payload) {
        Set<WebSocketSession> targets = sessions.get(showtimeId);
        if (targets == null || targets.isEmpty()) {
            return;
        }
        targets.removeIf(session -> {
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

    private Long showtimeId(URI uri) {
        if (uri == null || uri.getQuery() == null) return null;
        for (String pair : uri.getQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && "showtimeId".equals(parts[0])) {
                try {
                    return Long.valueOf(parts[1]);
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }
        return null;
    }
}
