package movieservice.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import lombok.RequiredArgsConstructor;
import movieservice.websocket.SeatInventoryWebSocketHandler;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class SeatInventoryWebSocketConfig implements WebSocketConfigurer {

    private final SeatInventoryWebSocketHandler handler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/seat-inventory")
                .setAllowedOriginPatterns("*");
    }
}
