use anchor_lang::{
    prelude::*,
    solana_program::{account_info::AccountInfo, system_instruction},
    Discriminator,
};
use solana_invoke::{invoke, invoke_signed};

pub fn system_transfer<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    lamports: u64,
) -> Result<()> {
    invoke(
        &system_instruction::transfer(&from.key(), &to.key(), lamports),
        &[from, to],
    )?;
    Ok(())
}

/// Creates or reallocates an account, making sure the correct `admin` is set.
///
/// If the account isn't already initialized, the function creates it normally.
/// If the account is already initialized, the function reallocates it to the
/// required `space`. At the end, `data` is written to the account.
///
/// Note that if the account is to be reallocated, it must already have `admin`
/// as the first field (the first 32 bytes coming after anchor discriminator).
pub fn init_or_realloc_with_admin<'info, T>(
    account: &AccountInfo<'info>,
    space: usize,
    admin: Pubkey,
    data: &T,
    payer: AccountInfo<'info>,
    signers_seeds: &[&[&[u8]]],
    claim_extra_lamports: bool,
) -> Result<()>
where
    T: AnchorSerialize + Discriminator,
{
    if !account.data_is_empty() {
        let existing_admin = Pubkey::try_from_slice(
            &account.try_borrow_data()?[T::DISCRIMINATOR.len()..T::DISCRIMINATOR.len() + 32],
        )?;
        require!(existing_admin == admin, ErrorCode::ConstraintHasOne);
    }

    init_or_realloc(
        account,
        space,
        data,
        payer,
        signers_seeds,
        claim_extra_lamports,
    )
}

/// Creates or reallocates an account.
///
/// If the account isn't already initialized, the function creates it normally.
/// If the account is already initialized, the function reallocates it to the
/// required `space`. At the end, `data` is written to the account.
pub fn init_or_realloc<'info, T>(
    account: &AccountInfo<'info>,
    space: usize,
    data: &T,
    payer: AccountInfo<'info>,
    signers_seeds: &[&[&[u8]]],
    claim_extra_lamports: bool,
) -> Result<()>
where
    T: AnchorSerialize + Discriminator,
{
    if account.data_is_empty() {
        // Initialize the account.
        let rent_lamports = Rent::get()?.minimum_balance(space);
        let ix = system_instruction::create_account(
            &payer.key(),
            &account.key(),
            rent_lamports,
            space as u64,
            &crate::ID,
        );
        invoke_signed(&ix, &[payer, account.clone()], signers_seeds)?;
    } else {
        realloc(account.clone(), payer, space, claim_extra_lamports)?;
    }

    let account_data = &mut *account.try_borrow_mut_data()?;
    account_data[..T::DISCRIMINATOR.len()].copy_from_slice(T::DISCRIMINATOR);
    data.serialize(&mut &mut account_data[T::DISCRIMINATOR.len()..])?;

    Ok(())
}

pub fn realloc<'info>(
    account: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    space: usize,
    claim_extra_lamports: bool,
) -> Result<()> {
    let rent_lamports = Rent::get()?.minimum_balance(space);
    let current_lamports = account.lamports();
    account.realloc(space, false)?;
    if rent_lamports > current_lamports {
        system_transfer(payer, account, rent_lamports - current_lamports)?;
    } else if claim_extra_lamports {
        account.sub_lamports(current_lamports - rent_lamports)?;
        payer.add_lamports(current_lamports - rent_lamports)?;
    }
    Ok(())
}
