package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.EngagementEventDto;
import com.repaircalc.backend_java.dto.EngagementMetricsDto;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
public class EngagementService {
    private final JdbcTemplate jdbc;

    public EngagementService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public void record(EngagementEventDto event) {
        boolean share = "share".equals(event.kind());
        boolean valid = event.id() != null && event.visitorId() != null && (share
                ? event.projectId() != null && !event.projectId().isBlank() && event.projectId().length() <= 200
                    && ("native".equals(event.method()) || "clipboard".equals(event.method())) && event.rating() == null
                : "rating".equals(event.kind()) && event.projectId() == null && event.method() == null
                    && event.rating() != null && Double.isFinite(event.rating())
                    && event.rating() >= 1 && event.rating() <= 5 && event.rating() == Math.rint(event.rating()));
        if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректное событие");
        int inserted = jdbc.update("""
                INSERT INTO repaircalc.engagement_events(id, visitor_id, kind, project_id, method, rating)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING
                """, event.id(), event.visitorId(), event.kind(), event.projectId(), event.method(),
                event.rating() == null ? null : event.rating().intValue());
        if (inserted == 0) {
            Boolean same = jdbc.queryForObject("""
                    SELECT visitor_id = ? AND kind = ? AND project_id IS NOT DISTINCT FROM ?
                        AND method IS NOT DISTINCT FROM ? AND rating IS NOT DISTINCT FROM ?
                    FROM repaircalc.engagement_events WHERE id = ?
                    """, Boolean.class, event.visitorId(), event.kind(), event.projectId(), event.method(),
                    event.rating() == null ? null : event.rating().intValue(), event.id());
            if (!Objects.equals(same, true))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Событие с этим идентификатором уже сохранено");
        }
    }

    public EngagementMetricsDto metrics() {
        return jdbc.queryForObject("""
                SELECT min(created_at) AS since,
                    count(*) FILTER (WHERE kind = 'share') AS shares,
                    count(DISTINCT visitor_id) FILTER (WHERE kind = 'share') AS visitors,
                    count(*) FILTER (WHERE kind = 'rating') AS ratings,
                    count(*) FILTER (WHERE rating = 1) AS one,
                    count(*) FILTER (WHERE rating = 2) AS two,
                    count(*) FILTER (WHERE rating = 3) AS three,
                    count(*) FILTER (WHERE rating = 4) AS four,
                    count(*) FILTER (WHERE rating = 5) AS five
                FROM repaircalc.engagement_events
                """, (rs, row) -> new EngagementMetricsDto(
                rs.getTimestamp("since") == null ? null : rs.getTimestamp("since").toInstant().toString(),
                new EngagementMetricsDto.Shares(rs.getLong("shares"), rs.getLong("visitors")),
                new EngagementMetricsDto.Ratings(rs.getLong("ratings"), List.of(
                        rs.getLong("one"), rs.getLong("two"), rs.getLong("three"), rs.getLong("four"), rs.getLong("five")))));
    }
}
