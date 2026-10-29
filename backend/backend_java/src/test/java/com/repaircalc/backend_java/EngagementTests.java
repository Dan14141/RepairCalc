package com.repaircalc.backend_java;

import com.repaircalc.backend_java.dto.EngagementEventDto;
import com.repaircalc.backend_java.service.EngagementService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class EngagementTests {
    @Autowired EngagementService engagement;

    @Test void persistsSharesCountsDistinctVisitorsAndDeduplicatesRetries() {
        var before = engagement.metrics();
        var visitor = UUID.randomUUID();
        var first = new EngagementEventDto(UUID.randomUUID(), visitor, "share", "test-project", "clipboard", null);
        engagement.record(first);
        engagement.record(first);
        engagement.record(new EngagementEventDto(UUID.randomUUID(), visitor, "share", "test-project", "native", null));
        engagement.record(new EngagementEventDto(UUID.randomUUID(), UUID.randomUUID(), "share", "test-project", "native", null));
        var after = engagement.metrics();
        assertThat(after.shares().total()).isEqualTo(before.shares().total() + 3);
        assertThat(after.shares().visitors()).isEqualTo(before.shares().visitors() + 2);
        assertThat(after.ratings()).isEqualTo(before.ratings());
        assertThat(after.since()).isNotNull();
    }

    @Test void aggregatesEveryStarAndKeepsAnAcknowledgedRatingImmutable() {
        var before = engagement.metrics();
        var visitor = UUID.randomUUID();
        for (double star = 1; star <= 5; star++) {
            var event = new EngagementEventDto(UUID.randomUUID(), visitor, "rating", null, null, star);
            engagement.record(event);
            engagement.record(event);
        }
        var after = engagement.metrics();
        assertThat(after.ratings().total()).isEqualTo(before.ratings().total() + 5);
        for (int i = 0; i < 5; i++)
            assertThat(after.ratings().distribution().get(i)).isEqualTo(before.ratings().distribution().get(i) + 1);
        var id = UUID.randomUUID();
        engagement.record(new EngagementEventDto(id, visitor, "rating", null, null, 5.0));
        assertThatThrownBy(() -> engagement.record(new EngagementEventDto(id, visitor, "rating", null, null, 1.0)))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode().value()).isEqualTo(409));
    }

    @Test void rejectsInvalidEventsBeforeTheyReachStorage() {
        var before = engagement.metrics();
        var visitor = UUID.randomUUID();
        for (Double rating : new Double[] {null, 0.0, 6.0, 2.5, Double.NaN})
            assertThatThrownBy(() -> engagement.record(new EngagementEventDto(UUID.randomUUID(), visitor, "rating", null, null, rating)))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode().value()).isEqualTo(400));
        assertThatThrownBy(() -> engagement.record(new EngagementEventDto(UUID.randomUUID(), visitor, "share", "test", "email", null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> engagement.record(new EngagementEventDto(UUID.randomUUID(), visitor, "share", " ", "clipboard", null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> engagement.record(new EngagementEventDto(UUID.randomUUID(), visitor, "rating", "project", null, 4.0)))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(engagement.metrics()).isEqualTo(before);
    }
}
