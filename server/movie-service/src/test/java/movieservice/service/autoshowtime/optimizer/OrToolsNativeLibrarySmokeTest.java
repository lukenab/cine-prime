package movieservice.service.autoshowtime.optimizer;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.LinearExpr;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Proves the OR-Tools native library actually loads and solves on this platform (Windows) before
 * any real solver code depends on it - a missing/incompatible native lib would otherwise surface
 * as a cryptic UnsatisfiedLinkError deep inside CpSatScheduleOptimizer instead of here.
 */
class OrToolsNativeLibrarySmokeTest {

    @Test
    void nativeLibraryLoadsAndSolvesATrivialModel() {
        Loader.loadNativeLibraries();

        CpModel model = new CpModel();
        IntVar x = model.newIntVar(0, 10, "x");
        IntVar y = model.newIntVar(0, 10, "y");
        model.addLessOrEqual(LinearExpr.newBuilder().add(x).add(y).build(), 15);
        model.maximize(LinearExpr.newBuilder().add(x).add(y).build());

        CpSolver solver = new CpSolver();
        CpSolverStatus status = solver.solve(model);

        assertEquals(CpSolverStatus.OPTIMAL, status);
        assertEquals(15, solver.value(x) + solver.value(y));
    }
}
