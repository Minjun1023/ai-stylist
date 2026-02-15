package com.aistylist.domain.converter;

import com.aistylist.domain.entity.PersonalColorResult;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class DiagnosisMethodConverter implements AttributeConverter<PersonalColorResult.DiagnosisMethod, String> {

    @Override
    public String convertToDatabaseColumn(PersonalColorResult.DiagnosisMethod attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public PersonalColorResult.DiagnosisMethod convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        return PersonalColorResult.DiagnosisMethod.valueOf(dbData.toUpperCase(Locale.ROOT));
    }
}
