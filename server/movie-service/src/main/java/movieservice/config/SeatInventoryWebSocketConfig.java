package movieservice.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import lombok.RequiredArgsConstructor;
import movieservice.websocket.SeatInventoryWebSocketHandler;
import movieservice.websocket.LifecycleWebSocketHandler;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class SeatInventoryWebSocketConfig implements WebSocketConfigurer {

    private final SeatInventoryWebSocketHandler handler;
    private final LifecycleWebSocketHandler lifecycleHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/seat-inventory")
                .setAllowedOriginPatterns("*");
        registry.addHandler(lifecycleHandler, "/ws/lifecycle")
                .setAllowedOriginPatterns("*");
    }
}
