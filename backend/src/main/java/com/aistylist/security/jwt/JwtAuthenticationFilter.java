package com.aistylist.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/*
 * JWT 인증 필터
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsService userDetailsService;

    /*
     * JWT 인증 필터
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        try {
            // JWT 토큰 추출
            String jwt = getJwtFromRequest(request);

            // JWT 토큰이 유효한 경우
            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                String email = tokenProvider.getEmailFromToken(jwt);

                // 사용자 정보 조회
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                // 인증 객체 생성
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                // 인증 객체 설정
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // 인증 객체 저장
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
            // JWT 토큰이 유효하지 않은 경우
        } catch (Exception ex) {
            log.error("사용자 설정 인증 오류", ex);
        }

        // 다음 필터 실행
        filterChain.doFilter(request, response);
    }

    /*
     * JWT 토큰 추출
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        // Authorization 헤더 추출
        String bearerToken = request.getHeader("Authorization");

        // Bearer 토큰 추출
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // JWT 토큰이 없는 경우
        return null;
    }
}
