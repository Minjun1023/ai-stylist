package com.aistylist.service;

import com.aistylist.domain.entity.PersonalColorResult;
import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.PersonalColorResultRepository;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.personalcolor.PersonalColorResponse;
import com.aistylist.dto.personalcolor.SurveyRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonalColorService {

    private final PersonalColorResultRepository personalColorResultRepository;
    private final UserRepository userRepository;
    // private final FastAPIClient fastAPIClient; // FastAPI 연동

    @Transactional(readOnly = true)
    public List<PersonalColorResponse> getUserResults(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        // 사용자별 퍼스널 컬러 진단 결과 조회
        return personalColorResultRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PersonalColorResponse diagnoseBySurvey(String email, SurveyRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        // FastAPI로 설문 데이터 전송 및 결과 받기
        // String colorType = fastAPIClient.analyzeSurvey(request);

        // 임시 응답 (나중에 FastAPI 연동 후 실제 분석 결과로 대체)
        String colorType = "spring_warm";

        // 설문 기반 퍼스널 컬러 진단 결과 저장
        PersonalColorResult result = PersonalColorResult.builder()
                .user(user)
                .colorType(colorType)
                .confidence(0.85f)
                .method(PersonalColorResult.DiagnosisMethod.SURVEY)
                .surveyData(request.getAnswers().toString())
                .build();

        PersonalColorResult saved = personalColorResultRepository.save(result);

        // 사용자 퍼스널 컬러 업데이트
        user.setPersonalColor(colorType);
        userRepository.save(user);

        return toResponse(saved);
    }

    @Transactional
    public PersonalColorResponse diagnoseByImage(String email, MultipartFile image) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        // 이미지 저장 및 FastAPI로 분석 요청
        // String imageUrl = fileService.saveFile(image);
        // String colorType = fastAPIClient.analyzeImage(imageUrl);

        // 임시 응답
        String colorType = "summer_cool";
        String imageUrl = "/uploads/temp.jpg";

        PersonalColorResult result = PersonalColorResult.builder()
                .user(user)
                .colorType(colorType)
                .confidence(0.92f)
                .method(PersonalColorResult.DiagnosisMethod.IMAGE)
                .imageUrl(imageUrl)
                .build();

        PersonalColorResult saved = personalColorResultRepository.save(result);

        // 사용자 퍼스널 컬러 업데이트
        user.setPersonalColor(colorType);
        userRepository.save(user);

        return toResponse(saved);
    }

    // PersonalColorResult를 PersonalColorResponse로 변환
    private PersonalColorResponse toResponse(PersonalColorResult result) {
        return PersonalColorResponse.builder()
                .id(result.getId())
                .colorType(result.getColorType())
                .confidence(result.getConfidence())
                .method(result.getMethod())
                .imageUrl(result.getImageUrl())
                .createdAt(result.getCreatedAt())
                .build();
    }
}
