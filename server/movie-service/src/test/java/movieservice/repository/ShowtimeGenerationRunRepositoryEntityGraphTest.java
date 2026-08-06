package movieservice.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.EntityGraph;

import java.lang.reflect.Method;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ShowtimeGenerationRunRepositoryEntityGraphTest {

    @Test
    void executorQueryLoadsEveryCollectionUsedOutsideTheRepositorySession() throws Exception {
        Method queryMethod = ShowtimeGenerationRunRepository.class
                .getMethod("findByGenerationRunId", Long.class);

        EntityGraph entityGraph = queryMethod.getAnnotation(EntityGraph.class);

        assertThat(entityGraph).isNotNull();
        assertThat(Set.of(entityGraph.attributePaths())).contains(
                "policy",
                "movies",
                "clusters",
                "excludedRooms",
                "screeningVersionOverrides",
                "screeningVersionOverrides.movie"
        );
    }
}
