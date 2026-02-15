package com.aistylist.domain.converter;

import com.aistylist.domain.entity.ChatMessage;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class ChatRoleConverter implements AttributeConverter<ChatMessage.Role, String> {

    @Override
    public String convertToDatabaseColumn(ChatMessage.Role attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public ChatMessage.Role convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return ChatMessage.Role.valueOf(dbData.toUpperCase(Locale.ROOT));
    }
}
