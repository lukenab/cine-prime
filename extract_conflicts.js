const fs = require('fs');
const files = [
  'client/src/components/shared/NowShowing.tsx',
  'client/src/routes/AppRoutes.tsx',
  'docker-compose.yml',
  'server/api-gateway/src/main/resources/application.yml',
  'server/auth-service/src/main/java/authservice/controller/AuthenticationController.java',
  'server/auth-service/src/main/java/authservice/entity/AuthToken.java',
  'server/auth-service/src/main/java/authservice/service/AuthenticationService.java',
  'server/auth-service/src/main/java/authservice/service/JwtService.java',
  'server/auth-service/src/main/resources/application.yml',
  'server/booking-service/pom.xml',
  'server/booking-service/src/main/java/bookingservice/BookingServiceApplication.java',
  'server/booking-service/src/main/java/bookingservice/controller/BookingController.java',
  'server/booking-service/src/main/java/bookingservice/repository/BookingRepository.java',
  'server/booking-service/src/main/java/bookingservice/repository/TicketRepository.java',
  'server/booking-service/src/main/java/bookingservice/service/BookingService.java',
  'server/booking-service/src/main/resources/application.yml',
  'server/common/pom.xml',
  'server/common/src/main/java/movie/theater/common/exception/GlobalErrorCode.java',
  'server/common/src/main/java/movie/theater/common/exception/GlobalExceptionHandler.java',
  'server/movie-service/src/main/java/movieservice/dto/response/ShowTimeResponse.java',
  'server/movie-service/src/main/java/movieservice/mapper/MovieMapper.java',
  'server/movie-service/src/main/java/movieservice/service/MovieService.java',
  'server/movie-service/src/main/java/movieservice/service/ShowTimeService.java',
  'server/user-service/src/main/java/userservice/entity/User.java'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`\n--- ${f} ---`);
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    let inConflict = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('<<<<<<<')) {
        inConflict = true;
        console.log(lines[i].trim());
      } else if (lines[i].startsWith('=======')) {
        console.log(lines[i].trim());
      } else if (lines[i].startsWith('>>>>>>>')) {
        console.log(lines[i].trim());
        inConflict = false;
      } else if (inConflict) {
        console.log(lines[i]);
      }
    }
  }
});
