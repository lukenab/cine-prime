package movieservice.service.autoshowtime.optimizer.cpsat;

import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.Literal;
import movieservice.service.autoshowtime.ShowtimeCandidate;

/**
 * One decision variable x[movie, version, room, businessDate, startSlot] plus the optional
 * interval OR-Tools needs for NoOverlap/Cumulative constraints. {@code presence} IS x - an
 * IntervalVar's own boolean presence literal is reused directly as the selection variable
 * instead of introducing a second, separately-constrained BoolVar, so "interval present" and
 * "candidate selected" can never disagree.
 */
public record CandidateVar(
        ShowtimeCandidate candidate,
        Literal presence,
        IntervalVar interval,
        long startMinutes,
        long endMinutes
) {
}
