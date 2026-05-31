import { ExchangeRateService } from '../Services/exchange-rate.service';


export class ClassFeeConverter {
    /**
     * Convert class fee to student's currency
     * 
     * @param classItem Class object with classFee property
     * @param studentCurrency Student's preferred currency (from student.currency)
     * @param exchangeRateService Injected ExchangeRateService
     * @param baseCurrency Base currency of class fee (default: 'USD')
     * @returns Class object with converted classFee
     */
    static async convertClassFeeForStudent(
        classItem: any,
        studentCurrency: string,
        exchangeRateService: ExchangeRateService,
        baseCurrency: string = 'USD'
    ): Promise<any> {
        if (!classItem.classFee || studentCurrency === baseCurrency) {
            return classItem;
        }

        try {
            const convertedFee = await exchangeRateService.convertCurrency(
                classItem.classFee,
                baseCurrency,
                studentCurrency
            );

            return {
                ...classItem,
                classFee: convertedFee,
                classFeeOriginal: classItem.classFee, // Keep original for reference
                classFeeBaseCurrency: baseCurrency,
                classFeeStudentCurrency: studentCurrency,
            };
        } catch (error) {
            console.error(`Failed to convert class fee: ${error.message}`);
            // Return original if conversion fails
            return classItem;
        }
    }

    /**
     * Convert multiple classes' fees to student's currency
     */
    static async convertClassFeesForStudent(
        classes: any[],
        studentCurrency: string,
        exchangeRateService: ExchangeRateService,
        baseCurrency: string = 'USD'
    ): Promise<any[]> {
        return Promise.all(
            classes.map((classItem) =>
                this.convertClassFeeForStudent(
                    classItem,
                    studentCurrency,
                    exchangeRateService,
                    baseCurrency
                )
            )
        );
    }

    /**
     * Convert enrollment assigned price to student's currency
     */
    static async convertEnrollmentPriceForStudent(
        enrollment: any,
        studentCurrency: string,
        exchangeRateService: ExchangeRateService,
        baseCurrency: string = 'USD'
    ): Promise<any> {
        if (!enrollment.assignedPrice || studentCurrency === baseCurrency) {
            return enrollment;
        }

        try {
            const convertedPrice = await exchangeRateService.convertCurrency(
                enrollment.assignedPrice,
                baseCurrency,
                studentCurrency
            );

            return {
                ...enrollment,
                assignedPrice: convertedPrice,
                assignedPriceOriginal: enrollment.assignedPrice,
                assignedPriceBaseCurrency: baseCurrency,
                assignedPriceStudentCurrency: studentCurrency,
            };
        } catch (error) {
            console.error(`Failed to convert enrollment price: ${error.message}`);
            return enrollment;
        }
    }
}
