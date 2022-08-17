import { NearBindgen, NearContract, near, call, view, UnorderedMap, Vector } from 'near-sdk-js';
import { assert, make_private } from './utils';
import { Donation, STORAGE_COST } from './model';

// The @NearBindgen decorator allows this code to compile to Base64.
@NearBindgen
class MyContract extends NearContract {
  greeting: string;
  beneficiary: string;
  donations: UnorderedMap;

  constructor({message="JOIN YOUR FAVORITE CIRCLES"}:{message: string}) {
    //execute the NEAR Contract's constructor
    super();
    this.greeting = message;
    this.beneficiary = "monad.testnet";
    this.donations = new UnorderedMap('map-uid-1');
  }

  default(){ return new MyContract({message: "JOIN YOUR FAVORITE CIRCLES"}) }

  // @call indicates that this is a 'change method' or a function
  // that changes state on the blockchain. Change methods cost gas.
  // For more info -> https://docs.near.org/docs/concepts/gas
  @call
    set_greeting({ message }: { message: string }): void {
    near.log(`Saving greeting ${message}`);
    this.greeting = message;
      
      // donate
      // Get who is calling the method and how much $NEAR they attached
      let donor = near.predecessorAccountId();
      let donationAmount: bigint = near.attachedDeposit() as bigint;

      let donatedSoFar = this.donations.get(donor) === null? BigInt(0) : BigInt(this.donations.get(donor) as string)
      let toTransfer = donationAmount;

      // This is the user's first donation, lets register it, which increases storage
      if(donatedSoFar == BigInt(0)) {
          assert(donationAmount > STORAGE_COST, `Attach at least ${STORAGE_COST} yoctoNEAR`);

          // Subtract the storage cost to the amount to transfer
          toTransfer -= STORAGE_COST
      }

      // Persist in storage the amount donated so far
      donatedSoFar += donationAmount
      this.donations.set(donor, donatedSoFar.toString())
      near.log(`Thank you ${donor} for donating ${donationAmount}! You donated a total of ${donatedSoFar}`);

      // Send the money to the beneficiary (TODO)
      const promise = near.promiseBatchCreate(this.beneficiary)
      near.promiseBatchActionTransfer(promise, toTransfer)
  }
    
  // @view indicates a 'view method' or a function that returns
  // the current values stored on the blockchain. View calls are free
  // and do not cost gas.
  @view
  get_greeting(): string {
    near.log(`The current greeting is ${this.greeting}`);
    return this.greeting;
  }
    
    @view
    get_donations({from_index = 0, limit = 50}: {from_index:number, limit:number}): Donation[] {
        let ret:Donation[] = []
        let end = Math.min(limit, this.donations.len())
        for(let i=from_index; i<end; i++){
            const account_id: string = this.donations.keys.get(i) as string
            const donation: Donation = this.get_donation_for_account({account_id})
            ret.push(donation)
        }
        return ret
    }

    @view
    get_donation_for_account({account_id}:{account_id:string}): Donation{
        return new Donation({
            account_id,
            total_amount: this.donations.get(account_id) as string
        })
    }
    
    @view
    total_donations() { return this.donations.len() }
}
