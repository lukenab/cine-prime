package workforceservice.repository;

import jakarta.persistence.*;
import org.springframework.stereotype.Repository;
import workforceservice.domain.WorkforceEnums.*;
import workforceservice.entity.*;
import java.time.*;
import java.util.*;

@Repository
public class WorkforceStore {
    @PersistenceContext private EntityManager em;

    public <T> T save(T entity) { return em.merge(entity); }
    public void flush() { em.flush(); }
    public <T> Optional<T> find(Class<T> type, String id) { return Optional.ofNullable(em.find(type, id)); }
    public Optional<EmployeeProjection> findProjectionForUpdate(String accountId) {
        return Optional.ofNullable(em.find(EmployeeProjection.class, accountId, LockModeType.PESSIMISTIC_WRITE));
    }
    public List<ShiftTemplate> templates(String clusterId) {
        return em.createQuery("select t from ShiftTemplate t where t.active=true and (t.clusterId is null or t.clusterId=:cluster) order by t.startTime", ShiftTemplate.class)
                .setParameter("cluster", clusterId).getResultList();
    }
    public List<RosterPeriod> rosters(String clusterId, LocalDate from, LocalDate to) {
        return em.createQuery("select r from RosterPeriod r where r.clusterId=:cluster and r.periodEnd>=:from and r.periodStart<=:to order by r.periodStart desc", RosterPeriod.class)
                .setParameter("cluster", clusterId).setParameter("from", from).setParameter("to", to).getResultList();
    }
    public List<EmployeeShift> shiftsByRoster(String rosterId) {
        return em.createQuery("select s from EmployeeShift s where s.rosterId=:roster order by s.startsAt, s.accountId", EmployeeShift.class)
                .setParameter("roster", rosterId).getResultList();
    }
    public List<EmployeeShift> shiftsForAccount(String accountId, OffsetDateTime from, OffsetDateTime to) {
        return em.createQuery("select s from EmployeeShift s where s.accountId=:account and s.endsAt>:from and s.startsAt<:to order by s.startsAt", EmployeeShift.class)
                .setParameter("account", accountId).setParameter("from", from).setParameter("to", to).getResultList();
    }
    public List<EmployeeShift> shiftsNear(String accountId, OffsetDateTime from, OffsetDateTime to, String excludedId) {
        return em.createQuery("select s from EmployeeShift s where s.accountId=:account and s.status<>:cancelled and s.shiftId<>:excluded and s.endsAt>:from and s.startsAt<:to", EmployeeShift.class)
                .setParameter("account", accountId).setParameter("cancelled", ShiftStatus.CANCELLED)
                .setParameter("excluded", excludedId == null ? "" : excludedId).setParameter("from", from).setParameter("to", to).getResultList();
    }
    public Optional<TimePunch> punchByIdempotencyKey(String key) {
        return em.createQuery("select p from TimePunch p where p.idempotencyKey=:key", TimePunch.class).setParameter("key", key).getResultStream().findFirst();
    }
    public List<TimePunch> punches(String shiftId) {
        return em.createQuery("select p from TimePunch p where p.shiftId=:shift order by p.occurredAt", TimePunch.class).setParameter("shift", shiftId).getResultList();
    }
    public List<EmployeeShift> shiftsMissingPunch(OffsetDateTime cutoff) {
        return em.createQuery("""
                select s from EmployeeShift s
                where s.endsAt < :cutoff
                  and s.status in :statuses
                  and not exists (select e.entryId from TimesheetEntry e where e.shiftId=s.shiftId)
                order by s.endsAt
                """, EmployeeShift.class)
                .setParameter("cutoff", cutoff)
                .setParameter("statuses", List.of(ShiftStatus.PUBLISHED, ShiftStatus.IN_PROGRESS))
                .setMaxResults(200)
                .getResultList();
    }
    public Optional<Timesheet> timesheet(String account, String cluster, LocalDate start, LocalDate end) {
        return em.createQuery("select t from Timesheet t where t.accountId=:account and t.clusterId=:cluster and t.periodStart=:start and t.periodEnd=:end", Timesheet.class)
                .setParameter("account", account).setParameter("cluster", cluster).setParameter("start", start).setParameter("end", end).getResultStream().findFirst();
    }
    public List<Timesheet> timesheetsForAccount(String account) {
        return em.createQuery("select t from Timesheet t where t.accountId=:account order by t.periodStart desc", Timesheet.class).setParameter("account", account).getResultList();
    }
    public List<Timesheet> timesheetsForCluster(String cluster, TimesheetStatus status) {
        String jpql = "select t from Timesheet t where t.clusterId=:cluster" + (status == null ? "" : " and t.status=:status") + " order by t.periodStart desc, t.accountId";
        TypedQuery<Timesheet> query = em.createQuery(jpql, Timesheet.class).setParameter("cluster", cluster);
        if (status != null) query.setParameter("status", status);
        return query.getResultList();
    }
    public Optional<TimesheetEntry> entryByShift(String shiftId) {
        return em.createQuery("select e from TimesheetEntry e where e.shiftId=:shift", TimesheetEntry.class).setParameter("shift", shiftId).getResultStream().findFirst();
    }
    public List<TimesheetEntry> entries(String timesheetId) {
        return em.createQuery("select e from TimesheetEntry e where e.timesheetId=:id order by e.actualStart", TimesheetEntry.class).setParameter("id", timesheetId).getResultList();
    }
    public List<TimesheetEntry> entriesForAccountBetween(String accountId, OffsetDateTime from, OffsetDateTime to) {
        return em.createQuery("""
                select e from TimesheetEntry e, Timesheet t
                where e.timesheetId=t.timesheetId and t.accountId=:account
                  and e.actualStart>=:from and e.actualStart<:to
                order by e.actualStart
                """, TimesheetEntry.class)
                .setParameter("account", accountId).setParameter("from", from).setParameter("to", to).getResultList();
    }
    public List<TimesheetEntry> entriesForClusterBetween(String clusterId, OffsetDateTime from, OffsetDateTime to) {
        return em.createQuery("""
                select e from TimesheetEntry e, Timesheet t
                where e.timesheetId=t.timesheetId and t.clusterId=:cluster
                  and e.actualStart>=:from and e.actualStart<:to
                order by t.accountId, e.actualStart
                """, TimesheetEntry.class)
                .setParameter("cluster", clusterId).setParameter("from", from).setParameter("to", to).getResultList();
    }
    public List<AttendanceException> exceptions(String entryId) {
        return em.createQuery("select e from AttendanceException e where e.entryId=:id order by e.createdAt", AttendanceException.class).setParameter("id", entryId).getResultList();
    }
    public long openExceptions(String timesheetId) {
        return em.createQuery("select count(x) from AttendanceException x, TimesheetEntry e where x.entryId=e.entryId and e.timesheetId=:id and x.status=:status", Long.class)
                .setParameter("id", timesheetId).setParameter("status", ExceptionStatus.OPEN).getSingleResult();
    }
    public List<ShiftSwapRequest> swapsForAccount(String accountId) {
        return em.createQuery("select r from ShiftSwapRequest r where r.requestedBy=:account or r.targetAccountId=:account order by r.createdAt desc", ShiftSwapRequest.class)
                .setParameter("account", accountId).getResultList();
    }
    public boolean hasActiveSwap(String shiftId) {
        return !em.createQuery("select r.requestId from ShiftSwapRequest r where r.sourceShiftId=:shift and r.status=:status", String.class)
                .setParameter("shift", shiftId).setParameter("status", RequestStatus.SUBMITTED).setMaxResults(1).getResultList().isEmpty();
    }
    public List<LeaveRequest> leavesForAccount(String accountId) {
        return em.createQuery("select r from LeaveRequest r where r.accountId=:account order by r.createdAt desc", LeaveRequest.class).setParameter("account", accountId).getResultList();
    }
    public List<ShiftSwapRequest> pendingSwaps(String clusterId) {
        return em.createQuery("select r from ShiftSwapRequest r, EmployeeShift s where r.sourceShiftId=s.shiftId and s.clusterId=:cluster and r.status=:status order by r.createdAt", ShiftSwapRequest.class)
                .setParameter("cluster", clusterId).setParameter("status", RequestStatus.SUBMITTED).getResultList();
    }
    public List<LeaveRequest> pendingLeaves(String clusterId) {
        return em.createQuery("select r from LeaveRequest r where r.clusterId=:cluster and r.status=:status order by r.createdAt", LeaveRequest.class)
                .setParameter("cluster", clusterId).setParameter("status", RequestStatus.SUBMITTED).getResultList();
    }
}
