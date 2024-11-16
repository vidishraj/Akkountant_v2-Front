import MilleniaCreditIcon from "../assets/icons/millenia-credit.jpg";
import HdfcDebitIcon from "../assets/icons/hdfc-debit.png";
import IciciAmazonPayIcon from "../assets/icons/icici-amazon-pay.png";
import YesBankAceIcon from "../assets/icons/yes-bank-ace.png";
import YesBankDebitIcon from "../assets/icons/yes-bank-debit.webp";
import BoiIcon from "../assets/icons/boi.png";

const bankIcons: Record<string, string> = {
    Millenia_Credit: MilleniaCreditIcon,
    HDFC_DEBIT: HdfcDebitIcon,
    ICICI_AMAZON_PAY: IciciAmazonPayIcon,
    YES_BANK_ACE: YesBankAceIcon,
    YES_BANK_DEBIT: YesBankDebitIcon,
    BOI: BoiIcon,
};


export const formatDate = (dateString: string): string => {
    // Validate the date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Expected format: YYYY-MM-DD");
    }

    // Parse the date components
    const [year, month, day] = dateString.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)); // Adjust month (0-indexed)

    // Format the date to a readable format
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    };

    return date.toLocaleDateString(undefined, options); // Use user's locale
};

export const getBankIcon = (bankKey: string): string | null => {
    return bankIcons[bankKey] || null;
};
