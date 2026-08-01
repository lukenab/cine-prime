package concessionservice.service;

import movie.theater.common.exception.AppException;
import movie.theater.common.security.JwtBranchScope;
import org.springframework.stereotype.Component;

import static concessionservice.exception.ConcessionErrorCode.CLUSTER_ACCESS_DENIED;

@Component
public class ClusterAccessPolicy {
    public void requireAccess(Long clusterId) {
        if (!JwtBranchScope.canAccess(clusterId)) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }
    }
}
