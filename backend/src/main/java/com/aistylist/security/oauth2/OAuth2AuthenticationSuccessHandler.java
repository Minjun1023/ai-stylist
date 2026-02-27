package com.aistylist.security.oauth2;

/**
 * com/aistylist/security/oauth2/OAuth2AuthenticationSuccessHandler.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.security.jwt.JwtTokenProvider;
import com.aistylist.service.SocialAuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Collections;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final SocialAuthService socialAuthService;
    private final JwtTokenProvider tokenProvider;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        try {
            OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
            OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

            User user = socialAuthService.findOrCreateUser(
                    oauthToken.getAuthorizedClientRegistrationId(),
                    oAuth2User.getAttributes()
            );

            Authentication jwtAuthentication = new UsernamePasswordAuthenticationToken(
                    user.getEmail(),
                    null,
                    Collections.emptyList()
            );
            String jwtToken = tokenProvider.generateToken(jwtAuthentication);

            String targetUrl = UriComponentsBuilder
                    .fromUriString(frontendUrl + "/oauth2/callback")
                    .queryParam("token", jwtToken)
                    .build(true)
                    .toUriString();

            clearAuthenticationAttributes(request);
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } catch (Exception e) {
            log.error("소셜 로그인 성공 처리 중 오류", e);
            String targetUrl = UriComponentsBuilder
                    .fromUriString(frontendUrl + "/login")
                    .queryParam("error", "social_login_failed")
                    .build(true)
                    .toUriString();
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        }
    }
}
