
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { calendarApi } from '../api/calendar';
import { CalendarOutfitRecord, CalendarOutfitSummary, CalendarScheduleRecord } from '../types';
import { ArrowLeftIcon, ArrowRightIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const monthLabel = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatSelectedDate = (key: string) => {
  const d = parseDateKey(key);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const formatScheduleDateTime = (date: string, time: string) => {
  try {
    const dt = new Date(`${date}T${time}`);
    return dt.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return time;
  }
};

const sortSchedules = (items: CalendarScheduleRecord[]) =>
  [...items].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return a.time.localeCompare(b.time);
  });

const CalendarPage: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(
    toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [monthlyOutfits, setMonthlyOutfits] = useState<CalendarOutfitSummary[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<CalendarScheduleRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CalendarOutfitRecord | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<CalendarScheduleRecord[]>([]);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [isDeletingOutfit, setIsDeletingOutfit] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevPadding = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const rawCells = [...prevPadding, ...days];
    const nextPaddingCount = (7 - (rawCells.length % 7)) % 7;
    const nextPadding = Array.from({ length: nextPaddingCount }, () => null);
    return [...rawCells, ...nextPadding];
  }, [currentMonth]);

  useEffect(() => {
    const loadMonth = async () => {
      setIsLoadingMonth(true);
      try {
        const [outfitData, scheduleData] = await Promise.all([
          calendarApi.getMonthlyOutfits(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
          calendarApi.getMonthlySchedules(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
        ]);
        setMonthlyOutfits(outfitData);
        setMonthlySchedules(sortSchedules(scheduleData));
      } catch (err: any) {
        alert(err.response?.data?.message || '월별 캘린더 기록을 불러오지 못했습니다.');
      } finally {
        setIsLoadingMonth(false);
      }
    };

    loadMonth();
  }, [currentMonth]);

  useEffect(() => {
    const loadDay = async () => {
      setIsLoadingDay(true);
      try {
        const [outfitData, schedulesData] = await Promise.all([
          calendarApi.getOutfitByDate(selectedDate),
          calendarApi.getSchedulesByDate(selectedDate),
        ]);
        setSelectedRecord(outfitData);
        setSelectedSchedules(sortSchedules(schedulesData));
        setScheduleTitle('');
        setScheduleTime('09:00');
        setSelectedFile(null);
        setPreviewUrl((prev) => {
          if (prev?.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
          }
          return outfitData?.imageDataUrl || null;
        });
      } catch (err: any) {
        alert(err.response?.data?.message || '일자별 캘린더 기록을 불러오지 못했습니다.');
      } finally {
        setIsLoadingDay(false);
      }
    };

    loadDay();
  }, [selectedDate]);

  const monthOutfitDateSet = useMemo(() => {
    const dateSet = new Set<string>();
    monthlyOutfits.forEach((item) => dateSet.add(item.date));
    return dateSet;
  }, [monthlyOutfits]);

  const monthScheduleDateSet = useMemo(() => {
    const dateSet = new Set<string>();
    monthlySchedules.forEach((item) => dateSet.add(item.date));
    return dateSet;
  }, [monthlySchedules]);

  const moveMonth = (delta: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(next);
    setSelectedDate(toDateKey(next.getFullYear(), next.getMonth(), 1));
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('이미지는 8MB 이하 파일만 업로드할 수 있습니다.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  };

  const saveOutfitRecord = async () => {
    if (!selectedFile) {
      alert('저장할 코디 이미지를 먼저 선택해주세요.');
      return;
    }

    setIsSavingOutfit(true);
    try {
      const saved = await calendarApi.saveOutfit(selectedDate, selectedFile);
      setSelectedRecord(saved);
      setPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return saved.imageDataUrl || prev;
      });
      setSelectedFile(null);
      setMonthlyOutfits((prev) => {
        const withoutCurrent = prev.filter((item) => item.date !== selectedDate);
        return [
          ...withoutCurrent,
          {
            date: selectedDate,
            updatedAt: saved.updatedAt || new Date().toISOString(),
          },
        ];
      });
      alert('코디가 저장되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.message || '코디 저장에 실패했습니다.');
    } finally {
      setIsSavingOutfit(false);
    }
  };

  const deleteOutfitRecord = async () => {
    if (!selectedRecord) {
      return;
    }

    setIsDeletingOutfit(true);
    try {
      await calendarApi.deleteOutfit(selectedDate);
      setSelectedRecord(null);
      setSelectedFile(null);
      setPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setMonthlyOutfits((prev) => prev.filter((item) => item.date !== selectedDate));
      alert('코디 기록이 삭제되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.message || '코디 기록 삭제에 실패했습니다.');
    } finally {
      setIsDeletingOutfit(false);
    }
  };

  const saveSchedule = async () => {
    const title = scheduleTitle.trim();
    if (!title) {
      alert('일정 제목을 입력해주세요.');
      return;
    }

    if (!scheduleTime) {
      alert('일정 시간을 선택해주세요.');
      return;
    }

    setIsSavingSchedule(true);
    try {
      const saved = await calendarApi.createSchedule(selectedDate, title, scheduleTime);
      setSelectedSchedules((prev) => sortSchedules([...prev, saved]));
      setMonthlySchedules((prev) => sortSchedules([...prev, saved]));
      setScheduleTitle('');
      setScheduleTime('09:00');
      alert('일정이 저장되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.message || '일정 저장에 실패했습니다.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const deleteSchedule = async (id: number) => {
    setDeletingScheduleId(id);
    try {
      await calendarApi.deleteSchedule(id);
      setSelectedSchedules((prev) => prev.filter((item) => item.id !== id));
      setMonthlySchedules((prev) => prev.filter((item) => item.id !== id));
      alert('일정이 삭제되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.message || '일정 삭제에 실패했습니다.');
    } finally {
      setDeletingScheduleId((prev) => (prev === id ? null : prev));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-reveal">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">코디 캘린더</h1>
        <p className="mt-1 text-slate-600">날짜를 선택하고 코디 이미지와 일정을 함께 기록하세요.</p>
      </section>

      <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => moveMonth(-1)}>
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            이전
          </Button>
          <p className="text-lg font-semibold text-gray-900">{monthLabel(currentMonth)}</p>
          <Button variant="outline" size="sm" onClick={() => moveMonth(1)}>
            다음
            <ArrowRightIcon className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-2">
          {monthDays.map((day, idx) => {
            if (!day) {
              return <div key={`blank-${idx}`} className="aspect-square rounded-lg bg-slate-50" />;
            }

            const key = toDateKey(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const isSelected = key === selectedDate;
            const hasOutfit = monthOutfitDateSet.has(key);
            const hasSchedule = monthScheduleDateSet.has(key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`relative aspect-square rounded-lg border text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-primary-50/40'
                }`}
              >
                {day}
                {(hasOutfit || hasSchedule) && (
                  <span className="absolute bottom-1 left-1 right-1 flex justify-center gap-1">
                    {hasOutfit && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
                    {hasSchedule && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex gap-2 text-xs text-slate-500">
          <span>파랑: 코디</span>
          <span>초록: 일정</span>
        </div>

        {isLoadingMonth && <p className="mt-3 text-sm text-slate-500">월별 기록을 불러오는 중...</p>}
      </section>

      <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-base font-semibold text-gray-900">{formatSelectedDate(selectedDate)}</p>
          <p className="text-sm text-slate-500">해당 날짜의 코디 이미지와 일정을 관리하세요.</p>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {previewUrl ? (
            <img src={previewUrl} alt="선택한 코디" className="h-64 w-full object-cover" />
          ) : (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <div className="text-center">
                <PhotoIcon className="mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">아직 등록된 코디가 없습니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100">
            이미지 선택
            <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          </label>
          <span className="truncate text-sm text-slate-500">
            {selectedFile?.name || selectedRecord?.fileName || '선택된 파일 없음'}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={saveOutfitRecord} disabled={isSavingOutfit || isLoadingDay}>
            {isSavingOutfit ? '저장 중...' : '코디 저장'}
          </Button>
          <Button
            variant="outline"
            onClick={deleteOutfitRecord}
            disabled={!selectedRecord || isDeletingOutfit || isLoadingDay}
          >
            <TrashIcon className="mr-1 h-4 w-4" />
            {isDeletingOutfit ? '삭제 중...' : '코디 삭제'}
          </Button>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-sm font-semibold text-slate-700">일정</p>
          <div className="space-y-2">
            {selectedSchedules.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                등록된 일정이 없습니다.
              </p>
            ) : (
              selectedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {formatScheduleDateTime(schedule.date, schedule.time)} - {schedule.title}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteSchedule(schedule.id)}
                    disabled={deletingScheduleId === schedule.id}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-slate-500">일정 제목</span>
              <input
                type="text"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                placeholder="예: 쇼핑 일정"
                maxLength={255}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-slate-500">시간</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              />
            </label>
            <Button onClick={saveSchedule} disabled={isSavingSchedule || isLoadingDay} className="h-10">
              {isSavingSchedule ? '저장 중...' : '일정 저장'}
            </Button>
          </div>
        </div>

        {isLoadingDay && <p className="mt-3 text-sm text-slate-500">일자 기록을 불러오는 중...</p>}
      </section>
    </div>
  );
};

export default CalendarPage;
