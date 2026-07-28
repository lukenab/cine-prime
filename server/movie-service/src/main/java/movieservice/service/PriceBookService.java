package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.PriceBookRequest;
import movieservice.dto.request.PriceRateRequest;
import movieservice.dto.response.PriceBookResponse;
import movieservice.dto.response.PriceRateResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.PriceBook;
import movieservice.entity.PriceRate;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.PriceBookStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.PriceBookRepository;
import movieservice.repository.ScreeningFormatRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PriceBookService {

    private final PriceBookRepository priceBookRepository;
    private final CinemaClusterRepository cinemaClusterRepository;
    private final ScreeningFormatRepository screeningFormatRepository;

    @Transactional(readOnly = true)
    public List<PriceBookResponse> listAll() {
        return priceBookRepository.findAllByOrderByUpdatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PriceBookResponse getById(Long priceBookId) {
        return toResponse(loadOrThrow(priceBookId));
    }

    @Transactional
    public PriceBookResponse create(PriceBookRequest request, String actor) {
        String code = normalizeCode(request.code());
        if (priceBookRepository.existsByCodeIgnoreCase(code)) {
            throw new AppException(MovieErrorCode.PRICE_BOOK_CODE_DUPLICATE);
        }

        PriceBook priceBook = PriceBook.builder()
                .status(PriceBookStatus.DRAFT)
                .createdBy(actor)
                .build();
        applyRequest(priceBook, request, code, actor);
        return toResponse(priceBookRepository.save(priceBook));
    }

    @Transactional
    public PriceBookResponse update(Long priceBookId, PriceBookRequest request, String actor) {
        PriceBook priceBook = loadOrThrow(priceBookId);
        ensureEditable(priceBook);
        String code = normalizeCode(request.code());
        if (priceBookRepository.existsByCodeIgnoreCaseAndPriceBookIdNot(code, priceBookId)) {
            throw new AppException(MovieErrorCode.PRICE_BOOK_CODE_DUPLICATE);
        }

        applyRequest(priceBook, request, code, actor);
        return toResponse(priceBookRepository.save(priceBook));
    }

    @Transactional
    public PriceBookResponse activate(Long priceBookId, String actor) {
        PriceBook priceBook = loadOrThrow(priceBookId);
        ensureEditable(priceBook);
        if (priceBook.getRates().stream().noneMatch(rate -> Boolean.TRUE.equals(rate.getActive()))) {
            throw new AppException(MovieErrorCode.PRICE_BOOK_REQUIRES_RATE);
        }
        priceBook.setStatus(PriceBookStatus.ACTIVE);
        priceBook.setUpdatedBy(actor);
        return toResponse(priceBookRepository.save(priceBook));
    }

    @Transactional
    public PriceBookResponse archive(Long priceBookId, String actor) {
        PriceBook priceBook = loadOrThrow(priceBookId);
        priceBook.setStatus(PriceBookStatus.ARCHIVED);
        priceBook.setUpdatedBy(actor);
        return toResponse(priceBookRepository.save(priceBook));
    }

    private void applyRequest(
            PriceBook priceBook,
            PriceBookRequest request,
            String normalizedCode,
            String actor) {
        if (request.validTo() != null && request.validTo().isBefore(request.validFrom())) {
            throw new AppException(MovieErrorCode.PRICE_BOOK_DATE_RANGE_INVALID);
        }

        CinemaCluster cluster = cinemaClusterRepository.findById(request.clusterId())
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        priceBook.setCluster(cluster);
        priceBook.setCode(normalizedCode);
        priceBook.setName(request.name().trim());
        priceBook.setCurrencyCode(request.currencyCode().trim().toUpperCase(Locale.ROOT));
        priceBook.setValidFrom(request.validFrom());
        priceBook.setValidTo(request.validTo());
        priceBook.setPriority(request.priority() == null ? 0 : request.priority());
        priceBook.setUpdatedBy(actor);
        priceBook.replaceRates(toRates(request.rates()));
    }

    private List<PriceRate> toRates(List<PriceRateRequest> requests) {
        if (requests == null) {
            return List.of();
        }
        return requests.stream().map(request -> {
            if (request.startTime().equals(request.endTime())) {
                throw new AppException(MovieErrorCode.PRICE_RATE_TIME_RANGE_INVALID);
            }
            ScreeningFormat format = request.formatId() == null
                    ? null
                    : screeningFormatRepository.findById(request.formatId())
                            .orElseThrow(() -> new AppException(MovieErrorCode.FORMAT_NOT_FOUND));
            return PriceRate.builder()
                    .name(request.name().trim())
                    .dayType(request.dayType())
                    .startTime(request.startTime())
                    .endTime(request.endTime())
                    .format(format)
                    .standardPrice(request.standardPrice())
                    .vipMultiplier(request.vipMultiplier())
                    .coupleMultiplier(request.coupleMultiplier())
                    .accessibleMultiplier(request.accessibleMultiplier())
                    .priority(request.priority() == null ? 0 : request.priority())
                    .active(request.active() == null || request.active())
                    .build();
        }).toList();
    }

    private PriceBook loadOrThrow(Long priceBookId) {
        return priceBookRepository.findById(priceBookId)
                .orElseThrow(() -> new AppException(MovieErrorCode.PRICE_BOOK_NOT_FOUND));
    }

    private void ensureEditable(PriceBook priceBook) {
        if (priceBook.getStatus() == PriceBookStatus.ARCHIVED) {
            throw new AppException(MovieErrorCode.PRICE_BOOK_ARCHIVED);
        }
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "_");
    }

    private PriceBookResponse toResponse(PriceBook book) {
        return new PriceBookResponse(
                book.getPriceBookId(),
                book.getCluster().getClusterId(),
                book.getCluster().getClusterName(),
                book.getCode(),
                book.getName(),
                book.getCurrencyCode(),
                book.getValidFrom(),
                book.getValidTo(),
                book.getPriority(),
                book.getStatus(),
                book.getRates().stream().map(this::toRateResponse).toList(),
                book.getCreatedBy(),
                book.getUpdatedBy(),
                book.getCreatedAt(),
                book.getUpdatedAt());
    }

    private PriceRateResponse toRateResponse(PriceRate rate) {
        return new PriceRateResponse(
                rate.getPriceRateId(),
                rate.getName(),
                rate.getDayType(),
                rate.getStartTime(),
                rate.getEndTime(),
                rate.getFormat() == null ? null : rate.getFormat().getFormatId(),
                rate.getFormat() == null ? null : rate.getFormat().getFormatCode(),
                rate.getStandardPrice(),
                rate.getVipMultiplier(),
                rate.getCoupleMultiplier(),
                rate.getAccessibleMultiplier(),
                rate.getPriority(),
                rate.getActive());
    }
}
