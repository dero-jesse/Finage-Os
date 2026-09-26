/**
 * Finage OS - Formatters & Financial Math Utilities
 */

const Formatter = {
  currency: 'UGX',
  currencySymbol: 'UGX ',

  setCurrency(curr) {
    this.currency = curr;
    switch (curr) {
      case 'KES':
        this.currencySymbol = 'KSh ';
        break;
      case 'EUR':
        this.currencySymbol = '€';
        break;
      case 'GBP':
        this.currencySymbol = '£';
        break;
      case 'USD':
        this.currencySymbol = '$';
        break;
      case 'UGX':
      default:
        this.currencySymbol = 'UGX ';
        break;
    }
  },

  /**
   * Formats a raw number to institutional currency string
   * e.g. 1450000 -> "$1,450,000" or "$1.45M"
   */
  money(amount, compact = false) {
    if (amount === undefined || amount === null || isNaN(amount)) return `${this.currencySymbol}0`;
    
    if (compact) {
      const absVal = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (absVal >= 1e9) {
        return `${sign}${this.currencySymbol}${(absVal / 1e9).toFixed(2)}B`;
      }
      if (absVal >= 1e6) {
        return `${sign}${this.currencySymbol}${(absVal / 1e6).toFixed(2)}M`;
      }
      if (absVal >= 1e3) {
        return `${sign}${this.currencySymbol}${(absVal / 1e3).toFixed(1)}k`;
      }
      return `${sign}${this.currencySymbol}${absVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }

    return `${this.currencySymbol}${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  },

  /**
   * Formats a ratio / percentage e.g. 0.185 -> "18.5%" or 18.5 -> "18.5%"
   */
  percent(val, isDecimal = false) {
    if (val === undefined || val === null || isNaN(val)) return '0.0%';
    const pct = isDecimal ? val * 100 : val;
    return `${pct.toFixed(1)}%`;
  },

  /**
   * Date to standard short format e.g. "28 Aug 2026"
   */
  date(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  /**
   * Date to day + time format e.g. "Aug 28, 14:30"
   */
  dateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

window.Formatter = Formatter;
