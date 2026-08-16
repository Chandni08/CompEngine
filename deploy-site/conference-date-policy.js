(() => {
  const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;

  function normalizeDateValue(value) {
    const candidate = String(value || "").slice(0, 10);
    return dateValuePattern.test(candidate) ? candidate : "";
  }

  function localCalendarDateValue(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function effectiveCurrentDate(asOfDate, now = new Date()) {
    const today = localCalendarDateValue(now);
    const normalizedAsOfDate = normalizeDateValue(asOfDate);
    return normalizedAsOfDate > today ? normalizedAsOfDate : today;
  }

  function isCurrentOrUpcoming(event, cutoffDate) {
    const finalEventDate = normalizeDateValue(event?.endDate || event?.startDate);
    const normalizedCutoff = normalizeDateValue(cutoffDate);
    return Boolean(finalEventDate && normalizedCutoff && finalEventDate >= normalizedCutoff);
  }

  globalThis.ConferenceDatePolicy = Object.freeze({
    effectiveCurrentDate,
    isCurrentOrUpcoming,
    localCalendarDateValue,
    normalizeDateValue,
  });
})();
