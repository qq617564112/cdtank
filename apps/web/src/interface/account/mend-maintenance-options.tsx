import type {TankMaintenanceQuote} from '../../../../shared/protocols/PtlTankMaintenance';
import {HomeCurrencyDot} from '../home/home-currency-dot';
import {GameButton} from '../resources/game-button';
import {ShopMaintenanceArtwork} from './shop-panel-artwork';
import './mend-maintenance-options.css';

const MAINTENANCE_DAYS = [1, 7, 30] as const;
const CARD_SIZE = {width: 122, height: 104};

/** The quote and its labels share one compact button layout. */
export function MendMaintenanceOptions({quotes, page, busy, canMaintain, maintain}: {
  quotes?: readonly TankMaintenanceQuote[];
  page: 'Tank' | 'Part';
  busy: boolean;
  canMaintain: boolean;
  maintain(quote: TankMaintenanceQuote): void;
}) {
  return <div className="mend-maintenance-options" role="group" aria-label="保养档位">
    <div className="mend-maintenance-grid">
      {([0, 1] as const).flatMap(currency => MAINTENANCE_DAYS.map((days, column) => {
        const quote = quotes?.find(value => value.days === days && value.currency === currency);
        const label = currency === 0 ? '星币' : '金钱';
        return <GameButton key={`${days}-${currency}`} shape="slab"
          className="shop-source-button mend-maintenance-card" data-shop-button-kind="maintenance"
          style={{...CARD_SIZE, gridColumn: column + 1, gridRow: currency + 1}}
          disabled={busy || !quote || !canMaintain}
          data-mend-repair="" data-mend-repair-days={days} data-mend-repair-currency={currency}
          data-mend-repair-binding={quote ? page === 'Tank'
            ? 'tank-maintenance-confirmed-quote' : 'part-maintenance-confirmed-quote' : 'unbound'}
          aria-label={`${label}保养${days}天${quote ? `，${quote.displayCost}${label}` : ''}`}
          onClick={() => {if (quote) maintain(quote);}}>
          <ShopMaintenanceArtwork {...CARD_SIZE} verticalInset={4}/>
          <span className="mend-maintenance-content">
            <span className="mend-maintenance-heading">用{label}保养</span>
            <span className="mend-maintenance-duration">保养{days}天</span>
            <span className="mend-maintenance-price" data-maintenance-currency={currency}>
              <HomeCurrencyDot tone={currency === 0 ? 'blue' : 'gold'}/>
              <span className="mend-maintenance-currency">{label}</span>
              <span className="mend-maintenance-amount">{quote?.displayCost ?? '—'}</span>
            </span>
          </span>
        </GameButton>;
      }))}
    </div>
  </div>;
}
